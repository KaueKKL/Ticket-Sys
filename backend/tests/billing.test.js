const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB, clearDB } = require('./setup');
const { ObjectId } = require('mongodb-legacy');
const Ticket = require('../models/Ticket');
const SystemConfig = require('../models/SystemConfig');
const { MongoClient } = require('mongodb-legacy');

let adminToken;
let legacyDb;

beforeAll(async () => {
  await connectDB();
  const client = new MongoClient(process.env.MONGO_LEGACY_URI);
  await client.connect();
  legacyDb = client.db();
});

afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe('Integração de Faturamento (DAV-OS)', () => {
  
  beforeEach(async () => {
    // 1. Admin
    const resUser = await request(app).post('/api/users').send({
      name: 'Admin Financeiro', email: 'fin@teste.com', password: '123', isAdmin: true
    });
    adminToken = resUser.body.token;

    // 2. Seeds
    const EMPRESA_ID = new ObjectId();
    const OBJETO_ID = new ObjectId();
    const SERVICO_ID = new ObjectId();
    const OPERACAO_ID = new ObjectId();
    const TRIBUTACAO_ID = new ObjectId();

    await legacyDb.collection('Pessoas').insertOne({
      _id: EMPRESA_ID, Nome: 'Minha Empresa Matriz', Ativo: true, _t: ['Pessoa', 'Juridica', 'Emitente'],
      Carteira: { EnderecoPrincipal: { Logradouro: 'Rua Teste' } }
    });

    await legacyDb.collection('Pessoas').insertOne({
      Nome: 'Cliente Teste S/A', Ativo: true, _t: ['Pessoa', 'Juridica'], Cnpj: '12345678000199',
      InformacoesPesquisa: ['cliente'], Carteira: { EmailPrincipal: { Endereco: 'cli@teste.com' } }
    });

    await legacyDb.collection('Objetos').insertOne({ _id: OBJETO_ID, Descricao: 'ATENDIMENTO', Ativo: true });

    // Simula Tributação Municipal externa (Hydration)
    await legacyDb.collection('TributacoesMunicipal').insertOne({
        _id: TRIBUTACAO_ID,
        Iss: { _t: 'ISSNormal', Percentual: 5.0 }
    });

    await legacyDb.collection('ProdutosServicos').insertOne({
      _id: SERVICO_ID, Descricao: 'HORA TECNICA', CodigoInterno: '999', Ativo: true, Tipo: 2,
      UnidadeMedida: { Sigla: 'H' }
    });

    await legacyDb.collection('ProdutosServicosEmpresa').insertOne({
      ProdutoServicoReferencia: SERVICO_ID, EmpresaReferencia: EMPRESA_ID, PrecoVenda: 150.00,
      TributacaoMunicipalReferencia: TRIBUTACAO_ID // Aponta para o objeto externo
    });

    await legacyDb.collection('OperacoesFiscais').insertOne({
      _id: OPERACAO_ID, Tipo: 23, Ativo: true, Cfop: { Codigo: 5933, Descricao: 'Svc' }
    });

    await legacyDb.collection('Contas').insertOne({ Ativo: true, Nome: 'Caixa', _id: new ObjectId() });
    await legacyDb.collection('PlanosConta').insertOne({ Ativo: true, CodigoUnico: '1.01', _id: new ObjectId() });
    await legacyDb.collection('CentrosCusto').insertOne({ Ativo: true, CodigoUnico: '100', _id: new ObjectId() });

    // 3. Config
    await SystemConfig.create({
      key: 'digisat_main',
      digisat: {
        empresaId: EMPRESA_ID.toString(), objetoId: OBJETO_ID.toString(),
        produtoServicoId: SERVICO_ID.toString(), operacaoFiscalId: OPERACAO_ID.toString()
      }
    });
  });

  it('Deve gerar uma OS completa com Itens e Parcelas Financeiras', async () => {
    const ticket = await Ticket.create({
      client: 'Cliente Teste S/A', reason: 'Teste', solution: 'Resolvido',
      technician: 'Tester', status: 'Finalizado', startDateTime: new Date(), endDateTime: new Date(), totalTime: 120
    });

    const res = await request(app)
      .post('/api/billing/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ticketId: ticket._id });

    expect(res.statusCode).toBe(200);
    
    // Prova Real
    const osGerada = await legacyDb.collection('Movimentacoes').findOne({ _id: new ObjectId(res.body.id) });
    
    expect(osGerada.ItensBase[0].ISS._t).toBe("ISSNormal");
    expect(osGerada.ItensBase[0].ISS.Percentual).toBe(5.0); // Veio da hydration
    expect(osGerada.PagamentoRecebimento.Parcelas[0].PlanoContaCodigoUnico).toBe("1.01");
  });
});