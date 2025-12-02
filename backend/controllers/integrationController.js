const connectLegacy = require('../config/legacyDb');
const digisatService = require('../services/digisatService');
const SystemConfig = require('../models/SystemConfig');
const { COLLECTION_PESSOAS, COLLECTION_OBJETOS, COLLECTION_TIPOS } = require('../config/digisatConstants');

// @desc    Busca opções no ERP Legado para preencher os selects de configuração
// @route   GET /api/integration/options
exports.getLegacyOptions = async (req, res) => {
  try {
    const db = await connectLegacy();
    if (!db) return res.status(500).json({ message: 'Sem conexão com banco legado.' });

    // 1. Empresas (Matriz)
    const empresas = await db.collection(COLLECTION_PESSOAS)
      .find({ Ativo: true, "_t": "Emitente" }) 
      .project({ Nome: 1, NomeFantasia: 1 })
      .limit(50).toArray();

    // 2. Objetos (Equipamentos)
    const objetos = await db.collection(COLLECTION_OBJETOS)
      .find({ Ativo: true })
      .project({ Descricao: 1 })
      .toArray();

    // 3. Tipos Personalizados (Datas extras)
    const tipos = await db.collection(COLLECTION_TIPOS)
      .find({ Ativo: true })
      .project({ Descricao: 1 })
      .toArray();

    // 4. FINANCEIRO: Serviços (TipoItem 09 = Serviço)
    // Buscamos apenas serviços ativos para evitar erro na OS
    const servicos = await db.collection('ProdutosServicos')
      .find({ Ativo: true, "TipoItem.Codigo": 9 }) 
      .project({ Descricao: 1, CodigoInterno: 1 })
      .limit(100).toArray();

    // 5. FINANCEIRO: Operações Fiscais (Tipo 23 = Saída Serviço Prestado)
    // Essencial para que o item da OS tenha tributação correta
    const operacoes = await db.collection('OperacoesFiscais')
      .find({ Ativo: true, Tipo: 23 }) 
      .project({ "Cfop.Descricao": 1, "Cfop.Codigo": 1 })
      .limit(50).toArray();

    // Busca configuração salva atual
    const currentConfig = await SystemConfig.findOne({ key: 'digisat_main' });

    res.json({
      empresas: empresas.map(e => ({ id: e._id, label: e.NomeFantasia || e.Nome })),
      objetos: objetos.map(o => ({ id: o._id, label: o.Descricao })),
      tipos: tipos.map(t => ({ id: t._id, label: t.Descricao })),
      
      // Novos mapeamentos
      servicos: servicos.map(s => ({ id: s._id, label: `${s.CodigoInterno} - ${s.Descricao}` })),
      operacoes: operacoes.map(op => ({ id: op._id, label: `${op.Cfop?.Codigo} - ${op.Cfop?.Descricao}` })),
      
      savedConfig: currentConfig ? currentConfig.digisat : {}
    });

  } catch (error) {
    console.error('Erro ao buscar opções do legado:', error);
    res.status(500).json({ message: 'Erro interno ao consultar ERP.' });
  }
};

// @desc    Salva a configuração de integração
// @route   POST /api/integration/config
exports.saveIntegrationConfig = async (req, res) => {
  try {
    const { 
      empresaId, objetoId, 
      campoInicioId, campoFimId, 
      produtoServicoId, operacaoFiscalId 
    } = req.body;

    await SystemConfig.findOneAndUpdate(
      { key: 'digisat_main' },
      { 
        digisat: { 
          empresaId, objetoId, 
          campoInicioId, campoFimId,
          produtoServicoId, operacaoFiscalId 
        },
        updatedBy: req.user.name,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({ message: 'Configurações de integração salvas com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar config:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.testLegacyInsert = async (req, res) => {
  try {
    const db = await connectLegacy();
    if (!db) return res.status(500).json({ message: 'Sem conexão com banco legado.' });

    const collection = db.collection(COLLECTION_PESSOAS);

    // Objeto de teste seguro (Inativo para não aparecer em buscas normais)
    const testDoc = {
      Nome: 'TICKET_SYS_TESTE_CONEXAO',
      NomeFantasia: 'REGISTRO DE DIAGNOSTICO - NAO USAR',
      Ativo: false, 
      _t: ['Pessoa', 'Juridica'],
      Observacao: 'Registro gerado automaticamente pelo Ticket-Sys para teste de escrita.',
      DataAlteracao: new Date()
    };

    const result = await collection.insertOne(testDoc);

    res.json({
      message: 'Teste de escrita SUCESSO! Registro inserido.',
      id: result.insertedId
    });

  } catch (error) {
    console.error('Erro teste insert:', error);
    res.status(500).json({ message: `Falha na escrita: ${error.message}` });
  }
};

// @desc    Teste de Remoção: Remove o cliente falso (Rollback)
// @route   POST /api/integration/test-remove
exports.testLegacyRemove = async (req, res) => {
  try {
    const db = await connectLegacy();
    if (!db) return res.status(500).json({ message: 'Sem conexão.' });

    const collection = db.collection(COLLECTION_PESSOAS);

    // Remove apenas o registro específico criado pelo teste
    const result = await collection.deleteMany({ Nome: 'TICKET_SYS_TESTE_CONEXAO' });

    if (result.deletedCount > 0) {
      res.json({ message: `Rollback SUCESSO! ${result.deletedCount} registro(s) removido(s).` });
    } else {
      res.status(404).json({ message: 'Nenhum registro de teste encontrado para limpar.' });
    }

  } catch (error) {
    console.error('Erro teste remove:', error);
    res.status(500).json({ message: `Falha na remoção: ${error.message}` });
  }
};

exports.testFullOsGeneration = async (req, res) => {
  try {
    const { clientName, reason } = req.body;

    // 1. Cria um "Mock" de Ticket (um objeto falso que imita um ticket)
    const mockTicket = {
      _id: 'TESTE_LAB_' + Date.now(),
      client: clientName,
      reason: reason || 'OS DE TESTE GERADA PELO LABORATORIO',
      solution: 'Teste de integração sistema Ticket-Sys',
      totalTime: 60, // 1 hora fixa
      startDateTime: new Date(),
      endDateTime: new Date(Date.now() + 3600000)
    };

    // 2. Chama o serviço real
    const result = await digisatService.createServiceOrder(mockTicket);

    res.json({
      message: 'OS de Teste Gerada!',
      osNumber: result.numeroOs,
      osId: result.insertedId
    });

  } catch (error) {
    console.error('Erro Laboratório:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove uma OS específica pelo ID (Rollback cirúrgico)
// @route   DELETE /api/integration/test-full-os/:id
exports.rollbackTestOs = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectLegacy();
    
    const result = await db.collection(COLLECTION_MOVIMENTACOES).deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      res.json({ message: 'Rollback realizado! OS removida do ERP.' });
    } else {
      res.status(404).json({ message: 'OS não encontrada para remoção.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};