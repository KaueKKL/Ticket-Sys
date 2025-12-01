const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB, clearDB } = require('./setup');

beforeAll(async () => await connectDB());
afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe('Ticket System Operations', () => {
  let token;
  let userId;

  // Cria usuário e loga antes dos testes
  beforeEach(async () => {
    const res = await request(app).post('/api/users').send({
      name: 'Técnico Java',
      email: 'java@teste.com',
      password: '123'
    });
    token = res.body.token;
    userId = res.body._id;
  });

  it('Deve criar um ticket e atribuir ao técnico logado automaticamente', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client: 'Cliente Teste',
        reason: 'Erro na impressora'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.technician).toBe('Técnico Java');
    expect(res.body.status).toBe('Em Andamento');
  });

  it('Deve adicionar uma nota interna (timeline)', async () => {
    // 1. Cria ticket
    const ticketRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente X', reason: 'Y' });
    
    const ticketId = ticketRes.body._id;

    // 2. Adiciona nota
    const noteRes = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Liguei para o cliente' });

    expect(noteRes.statusCode).toBe(200);
    expect(noteRes.body.notes).toHaveLength(1);
    expect(noteRes.body.notes[0].text).toBe('Liguei para o cliente');
    expect(noteRes.body.notes[0].createdBy).toBe('Técnico Java');
  });

  it('Deve filtrar tickets por técnico', async () => {
    // Ticket do Técnico Java
    await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Java', reason: 'Bug' });

    // Cria outro técnico
    const res2 = await request(app).post('/api/users').send({ name: 'Técnico Python', email: 'py@teste.com', password: '123' });
    const token2 = res2.body.token;

    // Ticket do Técnico Python
    await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token2}`)
      .send({ client: 'Cliente Python', reason: 'Script' });

    // Busca filtrando SÓ por "Técnico Java"
    const searchRes = await request(app)
      .get('/api/tickets?technician=Técnico Java')
      .set('Authorization', `Bearer ${token}`);

    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].client).toBe('Cliente Java');
  });
});