const connectLegacy = require('../config/legacyDb');
const SystemConfig = require('../models/SystemConfig');
const { 
  COLLECTION_PESSOAS, COLLECTION_MOVIMENTACOES, 
  COLLECTION_SEQUENCIAS, COLLECTION_OBJETOS, COLLECTION_TIPOS 
} = require('../config/digisatConstants');
const { ObjectId, Long, Double } = require('mongodb-legacy');
const { 
  generateCSharpVersion, 
  transformarPessoaParaHistorico, 
  transformarServicoParaHistorico,
  generateSearchInfo 
} = require('../utils/digisatUtils');

class DigisatService {
  
  async getNextOsNumber(db, empresaId) {
    const collection = db.collection(COLLECTION_SEQUENCIAS);
    const filtro = { "EmpresaReferencia": empresaId, "_t": ["SequenciaMovimentacao", "SequenciaDav"] };
    const result = await collection.findOneAndUpdate(
      filtro,
      { $inc: { "Contador": new Long(1) } },
      { returnDocument: 'after', upsert: true }
    );
    const doc = result.value || result;
    return typeof doc.Contador === 'object' ? doc.Contador : new Long(doc.Contador);
  }

  async createServiceOrder(ticket) {
    // 1. Validação de Configuração
    const sysConfig = await SystemConfig.findOne({ key: 'digisat_main' });
    if (!sysConfig?.digisat?.empresaId || !sysConfig?.digisat?.objetoId || !sysConfig?.digisat?.produtoServicoId || !sysConfig?.digisat?.operacaoFiscalId) {
      throw new Error('Configuração incompleta. Verifique Settings > Integração.');
    }

    const { empresaId, objetoId, campoInicioId, campoFimId, produtoServicoId, operacaoFiscalId } = sysConfig.digisat;
    const EMPRESA_ID = new ObjectId(empresaId);
    const OBJETO_ID = new ObjectId(objetoId);
    const SERVICO_ID = new ObjectId(produtoServicoId);
    const OPERACAO_ID = new ObjectId(operacaoFiscalId);

    const db = await connectLegacy();
    if (!db) throw new Error('Sem conexão com banco legado.');

    // 2. Busca de Entidades no ERP
    const cliente = await db.collection(COLLECTION_PESSOAS).findOne({ Nome: ticket.client, Ativo: true });
    if (!cliente) throw new Error(`Cliente "${ticket.client}" não encontrado.`);

    const empresa = await db.collection(COLLECTION_PESSOAS).findOne({ _id: EMPRESA_ID });
    const objetoAtendimento = await db.collection(COLLECTION_OBJETOS).findOne({ _id: OBJETO_ID });
    const servico = await db.collection('ProdutosServicos').findOne({ _id: SERVICO_ID });
    const operacaoFiscal = await db.collection('OperacoesFiscais').findOne({ _id: OPERACAO_ID });
    
    const prodServEmpresa = await db.collection('ProdutosServicosEmpresa').findOne({ 
      ProdutoServicoReferencia: SERVICO_ID, 
      EmpresaReferencia: EMPRESA_ID 
    });

    // Busca contas para o financeiro
    const contaPadrao = await db.collection('Contas').findOne({ Ativo: true });
    const planoConta = await db.collection('PlanosConta').findOne({ Ativo: true });
    const centroCusto = await db.collection('CentrosCusto').findOne({ Ativo: true });

    // IDs Financeiros Seguros (com fallback)
    const contaRef = contaPadrao ? contaPadrao._id : new ObjectId("000000000000000000000000");
    const planoContaRef = planoConta ? planoConta._id : new ObjectId("000000000000000000000000");
    const planoContaCod = (planoConta && planoConta.CodigoUnico) ? planoConta.CodigoUnico : "1.1.1";
    const centroCustoRef = centroCusto ? centroCusto._id : new ObjectId("000000000000000000000000");
    const centroCustoCod = (centroCusto && centroCusto.CodigoUnico) ? centroCusto.CodigoUnico : "1";

    // 3. Preparação Geral
    const agora = new Date();
    const vencimento = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const numeroOs = await this.getNextOsNumber(db, EMPRESA_ID);
    const versaoCSharp = generateCSharpVersion();

    // Criação dos Snapshots (Usando os utilitários corrigidos)
    const pessoaHist = transformarPessoaParaHistorico(cliente);
    const empresaHist = transformarPessoaParaHistorico(empresa);
    const servicoHistorico = transformarServicoParaHistorico(servico);

    const codigoIbge = empresa.Carteira?.EnderecoPrincipal?.Municipio?.CodigoIbge || 0;

    // 4. Montagem dos Campos Personalizados (Datas) e Objeto
    const camposPersonalizados = [];
    if (campoInicioId) {
        const tipo = await db.collection(COLLECTION_TIPOS).findOne({_id: new ObjectId(campoInicioId)});
        if(tipo) camposPersonalizados.push({ _t: "CampoPersonalizadoDataHora", TipoPersonalizado: tipo, ExibirImpressao: true, Valor: ticket.startDateTime });
    }
    if (campoFimId) {
        const tipo = await db.collection(COLLECTION_TIPOS).findOne({_id: new ObjectId(campoFimId)});
        if(tipo) camposPersonalizados.push({ _t: "CampoPersonalizadoDataHora", TipoPersonalizado: tipo, ExibirImpressao: true, Valor: ticket.endDateTime || agora });
    }

    const objetoSnapshot = {
        DataFinalGarantia: agora,
        PossuiGarantia: false,
        Defeito: ticket.reason,
        Diagnostico: ticket.solution || "Pendente",
        Objeto: objetoAtendimento,
        CamposPersonalizados: camposPersonalizados
    };

    // 5. CÁLCULOS FINANCEIROS (REGRA HORA CHEIA)
    const horasRaw = ticket.totalTime > 0 ? (ticket.totalTime / 60) : 1.0;
    
    // Arredonda sempre para cima (Teto)
    let qtdVal = Math.ceil(horasRaw);
    if (qtdVal < 1) qtdVal = 1; // Mínimo 1h

    // Preço (Do cadastro ou fallback R$ 50.00)
    const precoVal = parseFloat(prodServEmpresa?.PrecoVenda || 50.00);
    const totalVal = parseFloat((qtdVal * precoVal).toFixed(2));

    // Wrappers Double para o MongoDB (Apenas para o documento final)
    const qtdDouble = new Double(qtdVal);
    const precoDouble = new Double(precoVal);
    const totalDouble = new Double(totalVal);

    // 6. Montagem da Observação Formatada (Profissional)
    const formatTime = (date) => date ? new Date(date).toLocaleString('pt-BR') : '-';
    const duracaoHoras = Math.floor((ticket.totalTime || 0) / 60);
    const duracaoMinutos = (ticket.totalTime || 0) % 60;
    const tempoFormatado = `${duracaoHoras}h ${duracaoMinutos}m`;

    let obsTexto = `ATENDIMENTO TICKET #${ticket.ticketNumber || ticket._id.toString().slice(-6).toUpperCase()}\n`;
    obsTexto += `TECNICO: ${ticket.technician}\n`;
    obsTexto += `INICIO : ${formatTime(ticket.startDateTime)}\n`;
    if (ticket.endDateTime) {
        obsTexto += `FIM    : ${formatTime(ticket.endDateTime)}\n`;
    }
    obsTexto += `DURACAO: ${tempoFormatado} (Cobrado: ${qtdVal}h)\n`;
    
    if (ticket.pauses && ticket.pauses.length > 0) {
        obsTexto += `\n[PAUSAS]\n`;
        ticket.pauses.forEach(p => {
           const inicioP = new Date(p.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
           const fimP = p.end ? new Date(p.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';
           obsTexto += `- ${inicioP} até ${fimP}: ${p.reason || 'Pausa'}\n`;
        });
    }
    obsTexto += `PROBLEMA:\n${ticket.reason}\n\n`;
    if (ticket.solution) {
        obsTexto += `SOLUCAO:\n${ticket.solution}`;
    }

    // 7. Montagem do Item
    let issObject = null;
    if (prodServEmpresa.ISS || prodServEmpresa.Iss) {
        issObject = { ...(prodServEmpresa.ISS || prodServEmpresa.Iss) };
    } 
    if (!issObject && prodServEmpresa.TributacaoMunicipalReferencia) {
       let tributacaoMun = await db.collection('TributacoesMunicipal').findOne({ _id: prodServEmpresa.TributacaoMunicipalReferencia });
       if (!tributacaoMun) tributacaoMun = await db.collection('TributacoesMunicipais').findOne({ _id: prodServEmpresa.TributacaoMunicipalReferencia });

       if (tributacaoMun) {
         const issInterno = tributacaoMun.Iss || tributacaoMun.ISS;
         if (issInterno) {
           issObject = { ...issInterno };
           issObject._t = "ISSNormal"; 
           delete issObject._id;
         }
       }
    }
    // Fallback de segurança para ISS
    if (!issObject) {
        issObject = { 
            _t: "ISSNormal", 
            CstIss: { _t: "TributadoIntegralmente", Codigo: 0, Descricao: "Tributada integralmente" },
            Percentual: 2.0, PercentualBaseCalculo: 100.0, TipoTributacaoIss: 6, NaturezaTributacaoIss: 1,
            AliquotaCsll: 0.0, AliquotaInss: 0.0, AbaterValorCsllDoTotalLiquido: false, TruncarValorImposto: false
        };
    }

    const item = {
      _t: "ItemDocumentoAuxiliarSaidaServico",
      ProdutoServicoEmpresaReferencia: prodServEmpresa ? prodServEmpresa._id : new ObjectId(),
      VendedorReferencia: new ObjectId("000000000000000000000000"),
      TecnicoReferencia: new ObjectId("000000000000000000000000"),
      DataHora: agora,
      ProdutoServico: servicoHistorico, // Objeto Limpo
      Cancelado: false,
      Quantidade: qtdDouble, // Valor Arredondado
      DecimaisQuantidade: 2,
      PrecoUnitario: precoDouble,
      DecimaisPrecoUnitario: 2,
      Numero: 1,
      Observacao: "",
      OperacaoFiscal: operacaoFiscal,
      NCMNBS: prodServEmpresa?.NcmNbs || { _t: "NBS", Codigo: "00000000", Descricao: "SERVICO NAO ESPECIFICADO", AliquotaNacional: 0.0, Fonte: "FONTE PROPRIA" },
      CodigoIbgeMunicipioOcorrencia: codigoIbge,
      CodigoIbgeMunicipioIncidencia: codigoIbge,
      Objeto: objetoSnapshot, 
      CodigoTributacaoMunicipio: prodServEmpresa?.CodigoTributacaoMunicipio || "",
      Frete: 0.0, Seguro: 0.0, DescontoDigitado: 0.0,
      Autorizacoes: [],
      ISS: issObject,
      PIS: { _t: "PISCOFINSNaoTributadoComNaturezaReceitaSaida", CstPISCOFINS: { _t: "OperacaoIsentaDaContribuicao", Codigo: 7, Descricao: "Isenta" }, NaturezaReceita: { Codigo: 101, Descricao: "Outras" } },
      COFINS: { _t: "PISCOFINSNaoTributadoComNaturezaReceitaSaida", CstPISCOFINS: { _t: "OperacaoIsentaDaContribuicao", Codigo: 7, Descricao: "Isenta" }, NaturezaReceita: { Codigo: 101, Descricao: "Outras" } }
    };

    // 8. Financeiro
    const referenciaLong = new Long.fromString(Date.now().toString());
    const infoPesquisaParcela = [ 
        "gerado", "pelo", "sistema", 
        referenciaLong.toString(), 
        ...(cliente.InformacoesPesquisa || []), 
        totalVal.toFixed(2).replace('.', ',') 
    ];

    const parcelas = [];
    parcelas.push({
      _t: "ParcelaRecebimento",
      _id: new ObjectId(),
      InformacoesPesquisa: infoPesquisaParcela,
      Versao: versaoCSharp,
      Ativo: true, Ordem: 1, Descricao: "Gerado pelo Ticket-Sys", Observacao: `Ref. Ticket ${ticket._id}`,
      Referencia: referenciaLong, PessoaReferencia: cliente._id, Vencimento: vencimento, DataEmissao: agora,
      Historico: [{
        _t: "HistoricoAguardando", Valor: totalDouble,
        EspeciePagamento: { _t: "EspeciePagamentoECF", Codigo: 1, Descricao: "Dinheiro", EspecieRecebimento: { _t: "Dinheiro" } },
        PlanoContaCodigoUnico: planoContaCod, CentroCustoCodigoUnico: centroCustoCod, ContaReferencia: contaRef,
        EmpresaReferencia: empresa._id, NomeUsuario: "Ticket-Sys Web", Data: agora, ChequeReferencia: new ObjectId("000000000000000000000000"), Editado: false
      }],
      Situacao: { _t: "Aguardando", Codigo: 6 },
      ContaReferencia: contaRef, EmpresaReferencia: empresa._id, NomeUsuario: "Ticket-Sys Web",
      Pessoa: cliente, // Objeto Original
      Data: agora, Editado: false, ChequeReferencia: new ObjectId("000000000000000000000000"),
      PlanoContaCodigoUnico: planoContaCod, PlanoContaReferencia: planoContaRef,
      CentroCustoCodigoUnico: centroCustoCod, CentroCustoReferencia: centroCustoRef,
      EspeciePagamento: { _t: "EspeciePagamentoECF", Codigo: 1, Descricao: "Dinheiro", EspecieRecebimento: { _t: "Dinheiro" } },
      Juro: { _t: "JuroSimples", Codigo: 1, Descricao: "Simples", Percentual: 0.0, DiasCarencia: 0 },
      Multa: { Percentual: 0.0, DiasCarencia: 0 }
    });

    // 9. Montagem Final da OS
    const novaOS = {
      _id: new ObjectId(),
      _t: ["Movimentacao", "DocumentoAuxiliar", "DocumentoAuxiliarPrevisao", "DocumentoAuxiliarVendaBase", "DocumentoAuxiliarVendaOrdemServico"],
      InformacoesPesquisa: [String(numeroOs), String(cliente._id), ...(cliente.InformacoesPesquisa || [])],
      Versao: versaoCSharp,
      Ativo: true, Numero: numeroOs, DataHoraEmissao: agora,
      Pessoa: pessoaHist, // Snapshot
      EmpresaReferencia: EMPRESA_ID, Empresa: empresaHist,
      OrigemMobile: false, OrigemPedirMenu: false, Notificar: true, Convertida: false,
      ModalidadeFrete: { _t: "SemFrete", Codigo: 9, Descricao: "Sem frete" },
      
      // Observação Formatada
      Observacao: obsTexto,

      DataHoraPrevisao: agora, DataHoraRecebimento: agora,
      Atendimento: { _t: "Interno", Codigo: 1, Descricao: "Interno" },
      Objetos: [objetoSnapshot],
      DocumentoFiscalProdutoReferencia: new ObjectId("000000000000000000000000"),
      StatusDocumentoAuxiliarOrdemServico: { Status: { _t: "Analise", Codigo: 16 }, Observacao: "", DataHora: agora, Usuario: "Ticket-Sys Web" },
      ItensBase: [item],
      PagamentoRecebimento: { _t: "Recebimento", Parcelas: parcelas },
      Historicos: [{ SituacaoMovimentacao: { _t: ["SituacaoMovimentacao", "Aguardando"], Codigo: 1, Descricao: "Aguardando" }, NomeUsuario: "Ticket-Sys", Observacao: "Gerado via API", DataHora: agora }],
      Situacao: { _t: ["SituacaoMovimentacao", "Aguardando"], Codigo: 1, Descricao: "Aguardando" },
      Prioridade: { _t: "Normal", Codigo: 2, Descricao: "Normal" },
      IndicadorPresencaComprador: { _t: "OperacaoPresencial", Codigo: 1, Descricao: "Operação presencial" },
      IndicadorOperacaoConsumidorFinal: cliente.IndicadorOperacaoConsumidorFinal || { _t: "ConsumidorFinal", Codigo: 1, Descricao: "Consumidor final" },
      MovimentacoesReferenciadas: [], Animais: [], HistoricosDavDevolvido: [], DevolvidoLocacao: false,
      TipoDavOs: { _t: "Normal", Codigo: 0, Descricao: "Normal" },
      DadosContrato: "", DataVencimentoContrato: new Date("0001-01-01T00:00:00Z"), ImprimirPagamentoContrato: false
    };

    const result = await db.collection(COLLECTION_MOVIMENTACOES).insertOne(novaOS);
    return { numeroOs, insertedId: result.insertedId };
  }
}

module.exports = new DigisatService();