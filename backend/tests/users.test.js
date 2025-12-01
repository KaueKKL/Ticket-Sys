const request = require('supertest');
const app = require('../app'); // Importa o App Express
const { connectDB, closeDB, clearDB } = require('./setup');
const User = require('../models/User');

// Hooks do Jest para gerenciar o banco
beforeAll(async () => await connectDB());
afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe('Auth & User Management', () => {
  
  // Dados de teste
  const adminData = {
    name: 'Admin Teste',
    email: 'admin@teste.com',
    password: '123',
    isAdmin: true
  };

  // Variável para guardar o token do admin logado
  let adminToken;
  let adminId;

  // Antes de cada teste, cria um admin e pega o token
  beforeEach(async () => {
    // Cria usuário direto no banco (para garantir) ou via rota
    const res = await request(app).post('/api/users').send(adminData);
    adminToken = res.body.token;
    adminId = res.body._id;
  });

  it('Deve fazer login com sucesso', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: adminData.email, password: adminData.password });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.isAdmin).toBe(true);
  });

  it('NÃO deve permitir login com senha errada', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: adminData.email, password: 'senhaerrada' });

    expect(res.statusCode).toBe(401);
  });

  // --- O TESTE DO SEU PROBLEMA ESPECÍFICO ---
  it('Deve atualizar nome do usuário SEM quebrar a senha (senha vazia)', async () => {
    // 1. O admin tenta mudar o próprio nome, mandando password vazio
    const res = await request(app)
      .put(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Nome Novo',
        email: adminData.email,
        password: '' // <--- CENÁRIO DO ERRO
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Admin Nome Novo');

    // 2. Verifica se a senha antiga ainda funciona (não foi corrompida)
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ email: adminData.email, password: '123' }); // Senha antiga

    expect(loginRes.statusCode).toBe(200); // Se der 401, a senha foi estragada
  });

  it('Deve atualizar a senha quando uma NOVA senha é enviada', async () => {
    const res = await request(app)
      .put(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        password: 'novasenha456'
      });

    expect(res.statusCode).toBe(200);

    // Tenta logar com a nova senha
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ email: adminData.email, password: 'novasenha456' });

    expect(loginRes.statusCode).toBe(200);
  });

  it('Deve impedir cadastro de email duplicado', async () => {
    const res = await request(app)
      .post('/api/users')
      .send(adminData); // Tenta criar o mesmo email do beforeEach

    expect(res.statusCode).toBe(400); // Bad Request
    expect(res.body.message).toMatch(/já está cadastrado|em uso/i);
  });
});