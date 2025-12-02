const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB, clearDB } = require('./setup');
const Ticket = require('../models/Ticket'); // Importamos o model para verificações diretas no banco

beforeAll(async () => await connectDB());
afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe('Ticket System Operations Full Coverage', () => {
  let token;
  let user;

  // Cria usuário e loga antes de cada teste
  beforeEach(async () => {
    const res = await request(app).post('/api/users').send({
      name: 'Técnico Java',
      email: 'java@teste.com',
      password: '123'
    });
    token = res.body.token;
    user = res.body;
  });

  // --- 1. TESTES DE CRIAÇÃO ---
  it('Deve criar um ticket com numeração sequencial correta (YYYYMMDDxxxx)', async () => {
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
    
    // Verifica formato do TicketNumber: 8 dígitos data + 4 dígitos seq
    // Ex: 202512010001
    expect(res.body.ticketNumber).toMatch(/^\d{8}\d{4}$/); 
    expect(res.body.startDateTime).toBeDefined();
  });

  // --- 2. TESTES DE LEITURA E FILTROS ---
  it('Deve buscar ticket por ID', async () => {
    const created = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'Busca ID', reason: 'Teste' });

    const res = await request(app)
      .get(`/api/tickets/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.client).toBe('Busca ID');
  });

  it('Deve filtrar tickets por status, cliente e técnico', async () => {
    // Ticket 1: Java, Finalizado
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`)
      .send({ client: 'Empresa A', reason: 'Bug 1', status: 'Finalizado' });

    // Ticket 2: Java, Em Andamento
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`)
      .send({ client: 'Empresa B', reason: 'Bug 2' });

    // Filtro por Status
    const resStatus = await request(app)
      .get('/api/tickets?status=Finalizado')
      .set('Authorization', `Bearer ${token}`);
    expect(resStatus.body).toHaveLength(1);
    expect(resStatus.body[0].client).toBe('Empresa A');

    // Filtro por Nome do Cliente (Regex)
    const resClient = await request(app)
      .get('/api/tickets?client=Empresa B')
      .set('Authorization', `Bearer ${token}`);
    expect(resClient.body).toHaveLength(1);
    expect(resClient.body[0].client).toBe('Empresa B');
  });

  // --- 3. TESTES DE EDIÇÃO E FLUXO DE STATUS ---
  it('Deve atualizar dados básicos do ticket', async () => {
    const created = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Errado', reason: 'Motivo Errado' });

    const res = await request(app)
      .put(`/api/tickets/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Certo', reason: 'Motivo Certo' });

    expect(res.statusCode).toBe(200);
    expect(res.body.client).toBe('Cliente Certo');
  });

  // --- 4. TESTE LÓGICO DE TEMPO (PAUSA/PLAY) ---
  it('Deve calcular o tempo líquido corretamente descontando pausas (Simulação de Tempo)', async () => {
    // Mockamos o tempo para ter controle total
    jest.useFakeTimers();
    const systemTime = new Date('2025-12-01T10:00:00Z');
    jest.setSystemTime(systemTime);

    // 1. Cria ticket às 10:00
    const t1 = await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Tempo', reason: 'Teste Relógio' });
    const id = t1.body._id;

    // 2. Avança 30 min (10:30) e PAUSA
    jest.setSystemTime(new Date('2025-12-01T10:30:00Z'));
    await request(app).patch(`/api/tickets/${id}/status`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'Pausado' });

    // 3. Avança 30 min (11:00) e RETOMA (Esses 30 min de pausa não devem contar)
    jest.setSystemTime(new Date('2025-12-01T11:00:00Z'));
    await request(app).patch(`/api/tickets/${id}/status`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'Em Andamento' });

    // 4. Avança 30 min (11:30) e FINALIZA
    jest.setSystemTime(new Date('2025-12-01T11:30:00Z'));
    const finalRes = await request(app).patch(`/api/tickets/${id}/status`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'Finalizado' });

    // Cálculo esperado:
    // 10:00 -> 10:30 (Trabalhando) = 30 min
    // 10:30 -> 11:00 (Pausado)     = 0 min
    // 11:00 -> 11:30 (Trabalhando) = 30 min
    // Total esperado = 60 minutos
    
    expect(finalRes.statusCode).toBe(200);
    expect(finalRes.body.status).toBe('Finalizado');
    expect(finalRes.body.totalTime).toBe(60); 
    
    // Limpa os timers
    jest.useRealTimers();
  });

  it('Deve fechar a pausa automaticamente se finalizar direto (Edge Case)', async () => {
    const created = await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Rápido', reason: 'Teste' });

    // Pausa
    await request(app).patch(`/api/tickets/${created.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Pausado' });

    // Finaliza direto (sem dar play antes)
    const res = await request(app).patch(`/api/tickets/${created.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Finalizado' });

    expect(res.body.status).toBe('Finalizado');
    expect(res.body.endDateTime).toBeDefined();
    
    // Verifica no banco se a pausa foi fechada (tem data fim)
    const ticketNoBanco = await Ticket.findById(created.body._id);
    expect(ticketNoBanco.pauses[0].end).toBeDefined();
  });

  // --- 5. TESTES DE NOTAS ---
  it('Deve adicionar notas na timeline', async () => {
    const created = await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`)
      .send({ client: 'Cliente Nota', reason: 'Teste' });

    const res = await request(app)
      .post(`/api/tickets/${created.body._id}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Nota de teste 123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].text).toBe('Nota de teste 123');
    expect(res.body.notes[0].createdBy).toBe('Técnico Java');
  });

  // --- 6. TESTES DE EXCLUSÃO ---
  it('Deve excluir um ticket', async () => {
    const created = await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`)
      .send({ client: 'Para Deletar', reason: 'X' });

    const res = await request(app)
      .delete(`/api/tickets/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);

    // Tenta buscar de novo para garantir 404
    const check = await request(app).get(`/api/tickets/${created.body._id}`).set('Authorization', `Bearer ${token}`);
    expect(check.statusCode).toBe(404);
  });

});