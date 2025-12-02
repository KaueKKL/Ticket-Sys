const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB, clearDB } = require('./setup');
const Ticket = require('../models/Ticket');

// Configuração do Banco
beforeAll(async () => await connectDB());
afterEach(async () => {
  await clearDB();
  jest.restoreAllMocks(); // Restaura datas reais
});
afterAll(async () => await closeDB());

describe('Ticket System Full Test', () => {
  let token;

  // --- CORREÇÃO DO MOCK DE TEMPO ---
  const mockTime = (isoDate) => {
    const RealDate = Date; // Salva o construtor original
    const targetDate = new RealDate(isoDate);

    // Mock do construtor Date
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length) {
          return new RealDate(...args); // Se passar argumentos, usa o original
        }
        return targetDate; // Se não passar nada (new Date()), retorna a data fixada
      }
      static now() {
        return targetDate.getTime();
      }
    };
  };

  beforeEach(async () => {
    // Garante que estamos usando o Date real para o login (JWT precisa disso)
    global.Date = Date; 
    
    const res = await request(app).post('/api/users').send({
      name: 'Técnico Teste',
      email: `tech_${Math.random()}@test.com`,
      password: '123'
    });
    token = res.body.token;
  });

  it('Deve criar ticket com numeração sequencial (YYYYMMDDxxxx)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente A', reason: 'Teste' });

    expect(res.statusCode).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^\d{8}\d{4}$/); 
    expect(res.body.status).toBe('Em Andamento');
  });

  it('Deve calcular tempo descontando pausas (inclusive Aguardando Cliente)', async () => {
    // 1. INÍCIO: 10:00
    mockTime('2025-12-01T10:00:00Z');
    const created = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Tempo', reason: 'Teste' });
    const id = created.body._id;

    // 2. PAUSA: 10:30 (Trabalhou 30 min) -> Status: Aguardando Cliente
    mockTime('2025-12-01T10:30:00Z');
    await request(app).put(`/api/tickets/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Aguardando Cliente' });

    // 3. RETOMA: 11:00 (Ficou 30 min parado)
    mockTime('2025-12-01T11:00:00Z');
    await request(app).put(`/api/tickets/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Em Andamento' });

    // 4. FINALIZA: 11:30 (Trabalhou +30 min)
    mockTime('2025-12-01T11:30:00Z');
    const finalRes = await request(app).put(`/api/tickets/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Finalizado' });

    // Total esperado: (10:00 a 10:30) + (11:00 a 11:30) = 60 minutos
    expect(finalRes.body.status).toBe('Finalizado');
    expect(finalRes.body.totalTime).toBe(60);
  });

  it('Deve adicionar notas e filtrar', async () => {
    const t1 = await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Nota', reason: 'X' });

    // Adiciona Nota
    const resNota = await request(app).post(`/api/tickets/${t1.body._id}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Nota Teste' });
    
    expect(resNota.body.notes).toHaveLength(1);
    expect(resNota.body.notes[0].text).toBe('Nota Teste');

    // Filtro
    const resBusca = await request(app).get('/api/tickets?client=Cliente Nota')
      .set('Authorization', `Bearer ${token}`);
    expect(resBusca.body).toHaveLength(1);
  });
});