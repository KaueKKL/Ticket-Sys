const connectLegacy = require('../config/legacyDb');
const SystemConfig = require('../models/SystemConfig');
const digisatService = require('../services/digisatService'); // Importação do Serviço
const { COLLECTION_PESSOAS, COLLECTION_OBJETOS, COLLECTION_TIPOS, COLLECTION_MOVIMENTACOES } = require('../config/digisatConstants');
const { ObjectId } = require('mongodb-legacy');

// 1. Opções para Configuração
exports.getLegacyOptions = async (req, res) => {
  try {
    const db = await connectLegacy();
    if (!db) return res.status(500).json({ message: 'Sem conexão com banco legado.' });

    const empresas = await db.collection(COLLECTION_PESSOAS).find({ Ativo: true, "_t": "Emitente" }).project({ Nome: 1, NomeFantasia: 1 }).limit(50).toArray();
    const objetos = await db.collection(COLLECTION_OBJETOS).find({ Ativo: true }).project({ Descricao: 1 }).toArray();
    const tipos = await db.collection(COLLECTION_TIPOS).find({ Ativo: true }).project({ Descricao: 1 }).toArray();
    const servicos = await db.collection('ProdutosServicos').find({ Ativo: true, "TipoItem.Codigo": 9 }).project({ Descricao: 1, CodigoInterno: 1 }).limit(100).toArray();
    const operacoes = await db.collection('OperacoesFiscais').find({ Ativo: true, Tipo: 23 }).project({ "Cfop.Descricao": 1, "Cfop.Codigo": 1 }).limit(50).toArray();

    const currentConfig = await SystemConfig.findOne({ key: 'digisat_main' });

    res.json({
      empresas: empresas.map(e => ({ id: e._id, label: e.NomeFantasia || e.Nome })),
      objetos: objetos.map(o => ({ id: o._id, label: o.Descricao })),
      tipos: tipos.map(t => ({ id: t._id, label: t.Descricao })),
      servicos: servicos.map(s => ({ id: s._id, label: `${s.CodigoInterno} - ${s.Descricao}` })),
      operacoes: operacoes.map(op => ({ id: op._id, label: `${op.Cfop?.Codigo} - ${op.Cfop?.Descricao}` })),
      savedConfig: currentConfig ? currentConfig.digisat : {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao buscar opções.' });
  }
};

// 2. Salvar Configuração
exports.saveIntegrationConfig = async (req, res) => {
  try {
    const { empresaId, objetoId, campoInicioId, campoFimId, produtoServicoId, operacaoFiscalId } = req.body;
    await SystemConfig.findOneAndUpdate(
      { key: 'digisat_main' },
      { 
        digisat: { empresaId, objetoId, campoInicioId, campoFimId, produtoServicoId, operacaoFiscalId },
        updatedBy: req.user.name, updatedAt: new Date()
      },
      { new: true, upsert: true }
    );
    res.json({ message: 'Configurações salvas!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Smoke Test (Inserção Simples)
exports.testLegacyInsert = async (req, res) => {
  try {
    const db = await connectLegacy();
    const result = await db.collection(COLLECTION_PESSOAS).insertOne({
      Nome: 'TICKET_SYS_TESTE_CONEXAO',
      Ativo: false, _t: ['Pessoa', 'Juridica'], Observacao: 'Teste Smoke'
    });
    res.json({ message: 'Teste escrita OK', id: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.testLegacyRemove = async (req, res) => {
  try {
    const db = await connectLegacy();
    const result = await db.collection(COLLECTION_PESSOAS).deleteMany({ Nome: 'TICKET_SYS_TESTE_CONEXAO' });
    res.json({ message: `Rollback OK. ${result.deletedCount} removidos.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. LABORATÓRIO (Geração de OS Completa)
exports.testFullOsGeneration = async (req, res) => {
  try {
    const { clientName } = req.body;
    
    // Mock de Ticket
    const mockTicket = {
      _id: 'TESTE_LAB_' + Date.now(),
      client: clientName,
      reason: 'OS DE TESTE GERADA PELO LABORATORIO',
      solution: 'Teste de integração sistema Ticket-Sys',
      totalTime: 60,
      startDateTime: new Date(),
      endDateTime: new Date(Date.now() + 3600000)
    };

    const result = await digisatService.createServiceOrder(mockTicket);

    res.json({
      message: 'OS Gerada!',
      osNumber: result.numeroOs,
      osId: result.insertedId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 5. ROLLBACK DE OS (Remoção Cirúrgica)
exports.rollbackTestOs = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectLegacy();
    
    const result = await db.collection(COLLECTION_MOVIMENTACOES).deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount > 0) {
      res.json({ message: 'OS de teste removida com sucesso.' });
    } else {
      res.status(404).json({ message: 'OS não encontrada para remoção.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};