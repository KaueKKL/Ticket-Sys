const connectLegacy = require('../config/legacyDb');
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