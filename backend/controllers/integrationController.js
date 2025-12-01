const connectLegacy = require('../config/legacyDb');
const SystemConfig = require('../models/SystemConfig');
const { COLLECTION_PESSOAS, COLLECTION_OBJETOS, COLLECTION_TIPOS } = require('../config/digisatConstants');

exports.getLegacyOptions = async (req, res) => {
  try {
    const db = await connectLegacy();
    if (!db) return res.status(500).json({ message: 'Sem conexão com legado.' });

    // 1. Empresas (Matriz)
    const empresas = await db.collection(COLLECTION_PESSOAS)
      .find({ Ativo: true, "_t": "Emitente" }) 
      .project({ Nome: 1, NomeFantasia: 1 })
      .limit(50).toArray();

    // 2. Objetos
    const objetos = await db.collection(COLLECTION_OBJETOS)
      .find({ Ativo: true })
      .project({ Descricao: 1 })
      .toArray();

    // 3. Tipos Personalizados
    const tipos = await db.collection(COLLECTION_TIPOS)
      .find({ Ativo: true })
      .project({ Descricao: 1 })
      .toArray();

    // 4. NOVO: Produtos/Serviços (Filtrando apenas Serviços Ativos)
    // Geralmente Tipo=2 ou _t="Servico"
    const servicos = await db.collection('ProdutosServicos')
      .find({ Ativo: true, "TipoItem.Codigo" : 9 }) 
      .project({ Descricao: 1, CodigoInterno: 1 })
      .limit(50).toArray();

    // 5. NOVO: Operações Fiscais (CFOPs de Serviço)
    const operacoes = await db.collection('OperacoesFiscais')
      .find({ Ativo: true, Tipo: 23 }) // Tipo 23 costuma ser Saída Serviço
      .project({ "Cfop.Descricao": 1, "Cfop.Codigo": 1 })
      .limit(50).toArray();

    const currentConfig = await SystemConfig.findOne({ key: 'digisat_main' });

    res.json({
      empresas: empresas.map(e => ({ id: e._id, label: e.NomeFantasia || e.Nome })),
      objetos: objetos.map(o => ({ id: o._id, label: o.Descricao })),
      tipos: tipos.map(t => ({ id: t._id, label: t.Descricao })),
      // Mapeamento novo
      servicos: servicos.map(s => ({ id: s._id, label: `${s.CodigoInterno} - ${s.Descricao}` })),
      operacoes: operacoes.map(op => ({ id: op._id, label: `${op.Cfop?.Codigo} - ${op.Cfop?.Descricao}` })),
      
      savedConfig: currentConfig ? currentConfig.digisat : {}
    });

  } catch (error) {
    console.error('Erro options:', error);
    res.status(500).json({ message: 'Erro ao buscar opções.' });
  }
};

exports.saveIntegrationConfig = async (req, res) => {
  try {
    // Recebe os novos campos também
    const { empresaId, objetoId, campoInicioId, campoFimId, produtoServicoId, operacaoFiscalId } = req.body;

    await SystemConfig.findOneAndUpdate(
      { key: 'digisat_main' },
      { 
        digisat: { empresaId, objetoId, campoInicioId, campoFimId, produtoServicoId, operacaoFiscalId },
        updatedBy: req.user.name,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({ message: 'Configuração salva com sucesso!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};