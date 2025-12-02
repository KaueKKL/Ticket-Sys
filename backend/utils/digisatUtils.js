const { ObjectId, Long, Double } = require('mongodb-legacy');

// Gera versão C#
exports.generateCSharpVersion = () => {
  const now = new Date();
  const TICKS_PER_MS = 10000;
  const DAYS_TO_1970 = 719162;
  const MS_PER_DAY = 86400000;

  const msSince1970 = now.getTime();
  const daysSince1970 = Math.floor(msSince1970 / MS_PER_DAY);
  const msToday = msSince1970 % MS_PER_DAY;

  const totalDays = DAYS_TO_1970 + daysSince1970;
  const hours = String(Math.floor(msToday / 3600000)).padStart(2, '0');
  const minutes = String(Math.floor((msToday % 3600000) / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((msToday % 60000) / 1000)).padStart(2, '0');
  const fractionMs = msToday % 1000;
  const ticks = String(fractionMs * TICKS_PER_MS).padStart(7, '0');

  return `${totalDays}.${hours}:${minutes}:${seconds}.${ticks}`;
};

// Gera Array de Pesquisa
exports.generateSearchInfo = (...args) => {
  const terms = [];
  args.forEach(arg => {
    if (!arg) return;
    if (Array.isArray(arg)) {
      arg.forEach(item => {
        if (item && typeof item === 'string') terms.push(item.toLowerCase());
      });
    } else if (typeof arg === 'object' && arg.toString) {
      terms.push(arg.toString().toLowerCase());
    } else {
      terms.push(String(arg).toLowerCase());
    }
  });
  return [...new Set(terms)].filter(t => t.trim() !== '');
};

// Snapshot Pessoa (Histórico) - Mantido igual pois estava correto
exports.transformarPessoaParaHistorico = (doc) => {
  if (!doc) return null;
  const carteira = doc.Carteira || {};
  const isFisica = doc._t && (Array.isArray(doc._t) ? doc._t.includes("Fisica") : doc._t === "Fisica");

  const historico = {
    _t: isFisica ? "FisicaHistorico" : "JuridicaHistorico",
    PessoaReferencia: doc._id,
    Nome: doc.Nome,
    Classificacao: doc.Classificacao || { _t: "NaoContribuinte" },
    EnderecoPrincipal: carteira.EnderecoPrincipal || null,
    Cliente: doc.Cliente || { LimiteCredito: 0.0, DiasContatoPosVenda: 0, PercentualRetencaoIr: 0.0 },
    IndicadorOperacaoConsumidorFinal: doc.IndicadorOperacaoConsumidorFinal || { _t: "Normal", Codigo: 0, Descricao: "Normal" },
    IndicadorIeDestinatario: doc.IndicadorIeDestinatario || { _t: "NaoContribuinte" },
    Documento: isFisica ? doc.Cpf : doc.Cnpj,
    TelefonePrincipal: carteira.TelefonePrincipal ? carteira.TelefonePrincipal.Numero : "",
    EmailPrincipal: carteira.EmailPrincipal ? carteira.EmailPrincipal.Endereco : "",
    InformacoesPesquisa: doc.InformacoesPesquisa || [],
    EmailsNfe: [], EmailsOrcamento: [], EmailsPedidoVenda: [], EmailsOrdemServico: [], EmailsPedidoCompra: [], Rntrc: "", Celulares: [],
    Rg: isFisica ? (doc.Rg || { Numero: "", Uf: null, DataExpedicao: new Date("0001-01-01T00:00:00Z"), OrgaoEmissor: null }) : undefined
  };

  if (!isFisica) {
      historico.NomeFantasia = doc.NomeFantasia;
      if (carteira.Ie) historico.Ie = carteira.Ie.Numero;
  }
  return historico;
};

// --- Snapshot Serviço (REESCRITO - Whitelist Estrita) ---
exports.transformarServicoParaHistorico = (doc) => {
  if (!doc) return null;
  
  // Função Helper para Unidades (Limpa tudo exceto o essencial)
  const limparUnidade = (unidade) => {
      if (!unidade) return null;
      return {
          UnidadeMedidaReferencia: unidade._id || unidade.UnidadeMedidaReferencia || new ObjectId("000000000000000000000000"),
          Descricao: unidade.Descricao || "Unidade",
          Sigla: unidade.Sigla || "UN"
      };
  };

  const unid = limparUnidade(doc.UnidadeMedida);

  // Aqui montamos o objeto EXATAMENTE como ele deve ser, ignorando qualquer lixo do doc original
  const historico = {
    _t: "ServicoHistorico",
    ProdutoServicoReferencia: doc._id,
    CodigoInterno: doc.CodigoInterno || "0",
    Descricao: doc.Descricao || "Serviço",
    
    // Unidades
    UnidadeMedida: unid,
    UnidadeMedidaTributavel: doc.UnidadeMedidaTributavel ? limparUnidade(doc.UnidadeMedidaTributavel) : unid,
    FatorUnidadeMedidaTributavel: doc.FatorUnidadeMedidaTributavel || 0.0,
    
    // Financeiro
    PercentualComissao: doc.PercentualComissao || 0.0,
    PercentualCashback: doc.PercentualCashback || 0.0,
    
    // Indicadores Fiscais e de Regra de Negócio (Obrigatórios)
    IndicadorArredondamentoTruncamento: doc.IndicadorArredondamentoTruncamento || { _t: "Truncamento" },
    IndicadorProducaoPropriaTerceiro: doc.IndicadorProducaoPropriaTerceiro || { _t: "Terceiro" },
    
    // Contábil
    CodigoContabil: doc.CodigoContabil || "",
    CodigoContabilEntrada: doc.CodigoContabilEntrada || "",
    
    // Outros
    Tipo: doc.Tipo !== undefined ? doc.Tipo : 2,
    Observacao: doc.Observacao || "",
    
    // CNAE e Atividade (Copiar apenas se existir, mas sem trazer lixo aninhado)
    CodigoAtividade: doc.CodigoAtividade ? { 
        Codigo: doc.CodigoAtividade.Codigo, 
        Descricao: doc.CodigoAtividade.Descricao 
    } : null,
    
    Cnae: doc.Cnae ? {
        Codigo: doc.Cnae.Codigo,
        Denominacao: doc.Cnae.Denominacao,
        Descricao: doc.Cnae.Descricao,
        Item: doc.Cnae.Item,
        Subitem: doc.Cnae.Subitem,
        Aliquota: doc.Cnae.Aliquota,
        IdCnae: doc.Cnae.IdCnae,
        DataCancelamento: doc.Cnae.DataCancelamento
    } : null
  };

  return historico;
};