const connectLegacy = require('../config/legacyDb');
const SystemConfig = require('../models/SystemConfig');
const { 
  COLLECTION_PESSOAS, COLLECTION_MOVIMENTACOES, 
  COLLECTION_SEQUENCIAS, COLLECTION_OBJETOS, COLLECTION_TIPOS 
} = require('../config/digisatConstants');
const { ObjectId, Long, Double } = require('mongodb-legacy');
const { generateCSharpVersion, transformarPessoaParaHistorico } = require('../utils/digisatUtils');

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
    const sysConfig = await SystemConfig.findOne({ key: 'digisat_main' });
    if (!sysConfig?.digisat?.empresaId || !sysConfig?.digisat?.objetoId) {
      throw new Error('Configuração de Integração incompleta.');
    }

    const { empresaId, objetoId, campoInicioId, campoFimId, produtoServicoId, operacaoFiscalId } = sysConfig.digisat;
    const EMPRESA_ID = new ObjectId(empresaId);
    const OBJETO_ID = new ObjectId(objetoId);

    const db = await connectLegacy();
    if (!db) throw new Error('Sem conexão com banco legado.');

    const cliente = await db.collection(COLLECTION_PESSOAS).findOne({ Nome: ticket.client, Ativo: true });
    if (!cliente) throw new Error(`Cliente "${ticket.client}" não encontrado no ERP.`);

    const empresa = await db.collection(COLLECTION_PESSOAS).findOne({ _id: EMPRESA_ID });
    const objetoAtendimento = await db.collection(COLLECTION_OBJETOS).findOne({ _id: OBJETO_ID });

    const agora = new Date();
    const vencimento = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()); 
    const numeroOs = await this.getNextOsNumber(db, EMPRESA_ID);
    const pessoaHist = transformarPessoaParaHistorico(cliente);
    const empresaHist = transformarPessoaParaHistorico(empresa);
    const versaoCSharp = generateCSharpVersion();

    // Campos Personalizados
    const camposPersonalizados = [];
    if (campoInicioId) {
      const tipoInicio = await db.collection(COLLECTION_TIPOS).findOne({ _id: new ObjectId(campoInicioId) });
      if (tipoInicio) camposPersonalizados.push({ _t: "CampoPersonalizadoDataHora", TipoPersonalizado: tipoInicio, ExibirImpressao: true, Valor: ticket.startDateTime });
    }
    if (campoFimId) {
      const tipoFim = await db.collection(COLLECTION_TIPOS).findOne({ _id: new ObjectId(campoFimId) });
      const dataFimReal = ticket.endDateTime || agora;
      if (tipoFim) camposPersonalizados.push({ _t: "CampoPersonalizadoDataHora", TipoPersonalizado: tipoFim, ExibirImpressao: true, Valor: dataFimReal });
    }

    // Item e Financeiro
    const itensBase = [];
    let valorTotal = 0.0;

    if (produtoServicoId && operacaoFiscalId) {
      const SERVICO_ID = new ObjectId(produtoServicoId);
      const OPERACAO_ID = new ObjectId(operacaoFiscalId);
      
      const prodServico = await db.collection('ProdutosServicos').findOne({ _id: SERVICO_ID });
      const prodServicoEmpresa = await db.collection('ProdutosServicosEmpresa').findOne({ ProdutoServicoReferencia: SERVICO_ID, EmpresaReferencia: EMPRESA_ID });
      const operacaoFiscalDoc = await db.collection('OperacoesFiscais').findOne({ _id: OPERACAO_ID });

      if (prodServico && prodServicoEmpresa && operacaoFiscalDoc) {
        const servicoHistorico = { ...prodServico };
        servicoHistorico._t = "ServicoHistorico";
        servicoHistorico.ProdutoServicoReferencia = prodServico._id;
        delete servicoHistorico._id;
        if (!servicoHistorico.UnidadeMedidaTributavel) servicoHistorico.UnidadeMedidaTributavel = prodServico.UnidadeMedida;

        const qtdHoras = ticket.totalTime ? (ticket.totalTime / 60) : 0;
        const qtdFinal = parseFloat(qtdHoras.toFixed(2)) || 1.00;
        const precoUnitario = (prodServicoEmpresa.PrecoVenda && prodServicoEmpresa.PrecoVenda > 0) ? prodServicoEmpresa.PrecoVenda : 50.0;
        valorTotal = qtdFinal * precoUnitario;

        // --- TRATAMENTO ROBUSTO DO ISS ---
        let issObject = null;

        // 1. Tenta pegar direto do produto (se existir)
        if (prodServicoEmpresa.ISS || prodServicoEmpresa.Iss) {
            issObject = { ...(prodServicoEmpresa.ISS || prodServicoEmpresa.Iss) };
        } 
        
        // 2. Se não tem, tenta buscar na Tributação Municipal (Hydration)
        if (!issObject && prodServicoEmpresa.TributacaoMunicipalReferencia) {
           console.log('🔍 Buscando Tributacao Municipal:', prodServicoEmpresa.TributacaoMunicipalReferencia);
           
           // Tenta plural e singular, pois o legado pode variar
           let tributacaoMun = await db.collection('TributacoesMunicipal').findOne({ _id: prodServicoEmpresa.TributacaoMunicipalReferencia });
           if (!tributacaoMun) {
               tributacaoMun = await db.collection('TributacoesMunicipais').findOne({ _id: prodServicoEmpresa.TributacaoMunicipalReferencia });
           }

           if (tributacaoMun) {
             // AQUI ESTÁ O SEGREDO: Pegar a propriedade interna .Iss ou .ISS
             // O documento TributacaoMunicipal é apenas um container. O objeto real do imposto está dentro dele.
             const issInterno = tributacaoMun.Iss || tributacaoMun.ISS;
             
             if (issInterno) {
               issObject = { ...issInterno };
               // Força o discriminador correto e remove o ID para não dar conflito
               issObject._t = "ISSNormal"; 
               delete issObject._id;
             } else {
               console.warn('⚠️ AVISO: TributacaoMunicipal encontrada, mas sem objeto Iss interno.');
             }
           }
        }

        // 3. FALLBACK DE SEGURANÇA (Evita Crash)
        if (!issObject) {
            console.warn('⚠️ AVISO: Usando ISS Padrão Zerado (Fallback).');
            issObject = { 
                _t: "ISSNormal", 
                CstIss: { _t: "TributadoIntegralmente", Codigo: 0, Descricao: "Tributada integralmente" },
                Percentual: 2.0, 
                PercentualBaseCalculo: 100.0,
                TipoTributacaoIss: 6,
                NaturezaTributacaoIss: 1,
                AliquotaCsll: 0.0,
                AliquotaInss: 0.0,
                AbaterValorCsllDoTotalLiquido: false,
                TruncarValorImposto: false
            };
        }

        itensBase.push({
          _t: "ItemDocumentoAuxiliarSaidaServico",
          ProdutoServicoEmpresaReferencia: prodServicoEmpresa._id,
          VendedorReferencia: new ObjectId("000000000000000000000000"),
          TecnicoReferencia: new ObjectId("000000000000000000000000"),
          DataHora: agora,
          ProdutoServico: servicoHistorico,
          Cancelado: false,
          Quantidade: new Double(qtdFinal),
          DecimaisQuantidade: 2,
          PrecoUnitario: new Double(precoUnitario),
          DecimaisPrecoUnitario: 2,
          Numero: 1,
          Observacao: "",
          OperacaoFiscal: operacaoFiscalDoc,
          NCMNBS: prodServicoEmpresa.NcmNbs || null,
          CodigoTributacaoMunicipio: prodServicoEmpresa.CodigoTributacaoMunicipio || "",
          Frete: 0.0, Seguro: 0.0, DescontoDigitado: 0.0,
          Autorizacoes: [],
          
          // ISS Injetado Corretamente
          ISS: issObject,

          PIS: { 
            _t: "PISCOFINSNaoTributadoComNaturezaReceitaSaida", 
            CstPISCOFINS: { _t: "OperacaoIsentaDaContribuicao", Codigo: 7, Descricao: "Isenta" }, 
            NaturezaReceita: { Codigo: 101, Descricao: "Outras" } 
          },
          COFINS: { 
            _t: "PISCOFINSNaoTributadoComNaturezaReceitaSaida", 
            CstPISCOFINS: { _t: "OperacaoIsentaDaContribuicao", Codigo: 7, Descricao: "Isenta" }, 
            NaturezaReceita: { Codigo: 101, Descricao: "Outras" } 
          }
        });
      }
    }

    // Financeiro
    const contaPadrao = await db.collection('Contas').findOne({ Ativo: true });
    const planoConta = await db.collection('PlanosConta').findOne({ Ativo: true });
    const centroCusto = await db.collection('CentrosCusto').findOne({ Ativo: true });
    
    const contaRef = contaPadrao ? contaPadrao._id : new ObjectId("000000000000000000000000");
    const planoContaRef = planoConta ? planoConta._id : new ObjectId("000000000000000000000000");
    const planoContaCod = (planoConta && planoConta.CodigoUnico) ? planoConta.CodigoUnico : "1.1.1";
    const centroCustoRef = centroCusto ? centroCusto._id : new ObjectId("000000000000000000000000");
    const centroCustoCod = (centroCusto && centroCusto.CodigoUnico) ? centroCusto.CodigoUnico : "1";

    const parcelas = [];
    if (valorTotal > 0) {
      const referenciaLong = new Long.fromString(Date.now().toString() + Math.floor(Math.random() * 100).toString());
      // Correção na lista de informações de pesquisa: Strings apenas
      const infoPesquisaParcela = [
          "gerado", "pelo", "sistema", 
          referenciaLong.toString(), 
          ...(cliente.InformacoesPesquisa || []), 
          valorTotal.toFixed(2).replace('.', ',')
      ];

      parcelas.push({
        _t: "ParcelaRecebimento",
        _id: new ObjectId(),
        Versao: versaoCSharp,
        Ativo: true,
        Ordem: 1,
        Descricao: "Gerado pelo Ticket-Sys",
        Observacao: "",
        Referencia: referenciaLong,
        PessoaReferencia: cliente._id,
        Vencimento: vencimento,
        DataEmissao: agora,
        Valor: new Double(valorTotal),
        Historico: [{
            _t: "HistoricoAguardando",
            Valor: new Double(valorTotal),
            EspeciePagamento: { 
                _t: "EspeciePagamentoECF", 
                Codigo: 1, 
                Descricao: "Dinheiro", 
                EspecieRecebimento: { _t: "Dinheiro" } 
            },
            PlanoContaCodigoUnico: planoContaCod,
            CentroCustoCodigoUnico: centroCustoCod,
            ContaReferencia: contaRef,
            EmpresaReferencia: empresa._id,
            NomeUsuario: "Ticket-Sys Web",
            Data: agora,
            ChequeReferencia: new ObjectId("000000000000000000000000"),
            Editado: false
        }],
        Situacao: { _t: "Aguardando", Codigo: 6 },
        EspeciePagamento: { 
            _t: "EspeciePagamentoECF", 
            Codigo: 1, 
            Descricao: "Dinheiro", 
            EspecieRecebimento: { _t: "Dinheiro" } 
        },
        ContaReferencia: contaRef,
        PlanoContaCodigoUnico: planoContaCod,
        PlanoContaReferencia: planoContaRef,
        CentroCustoCodigoUnico: centroCustoCod,
        CentroCustoReferencia: centroCustoRef,
        EmpresaReferencia: empresa._id,
        NomeUsuario: "Ticket-Sys Web",
        Pessoa: cliente,
        Data: agora,
        Editado: false,
        ChequeReferencia: new ObjectId("000000000000000000000000"),
        InformacoesPesquisa: infoPesquisaParcela,
        DataQuitacao: new Date("0001-01-01T00:00:00Z"),
        Juro: { _t: "JuroSimples", Codigo: 1, Descricao: "Simples", Percentual: 0.0, DiasCarencia: 0 },
        Multa: { Percentual: 0.0, DiasCarencia: 0 }
      });
    }

    const novaOS = {
      _t: ["Movimentacao", "DocumentoAuxiliar", "DocumentoAuxiliarPrevisao", "DocumentoAuxiliarVendaBase", "DocumentoAuxiliarVendaOrdemServico"],
      InformacoesPesquisa: [String(numeroOs), String(cliente._id), ...(cliente.InformacoesPesquisa || [])],
      Versao: versaoCSharp,
      Ativo: true,
      Numero: numeroOs,
      DataHoraEmissao: agora,
      Pessoa: pessoaHist,
      EmpresaReferencia: empresa._id,
      Empresa: empresaHist,
      OrigemMobile: false,
      OrigemPedirMenu: false, Notificar: true, Convertida: false,
      Prioridade: { _t: "Normal", Codigo: 2, Descricao: "Normal" },
      TipoDavOs: { _t: "Normal", Codigo: 0, Descricao: "Normal" },
      ItensBase: itensBase,
      Historicos: [{ SituacaoMovimentacao: { _t: ["SituacaoMovimentacao", "Aguardando"], Codigo: 1, Descricao: "Aguardando" }, DataHora: agora, Usuario: "Ticket-Sys Web" }],
      Situacao: { _t: ["SituacaoMovimentacao", "Aguardando"], Codigo: 1, Descricao: "Aguardando" },
      Observacao: `Ticket: ${ticket._id}\nProblema: ${ticket.reason}\nSolução: ${ticket.solution || ''}`,
      DataHoraPrevisao: agora,
      DataHoraRecebimento: agora,
      Atendimento: { _t: "Interno", Codigo: 1, Descricao: "Interno" },
      Objetos: [{
        DataFinalGarantia: agora,
        PossuiGarantia: false,
        Defeito: ticket.reason,
        Diagnostico: ticket.solution || "Pendente",
        Objeto: objetoAtendimento,
        CamposPersonalizados: camposPersonalizados
      }],
      DocumentoFiscalProdutoReferencia: new ObjectId("000000000000000000000000"),
      StatusDocumentoAuxiliarOrdemServico: { Status: { _t: "Analise", Codigo: 16 }, DataHora: agora, Usuario: "Ticket-Sys Web" },
      DevolvidoLocacao: false,
      MovimentacoesReferenciadas: [],
      HistoricosDavDevolvido: [], 
      ContaReferencia: contaRef,
      PagamentoRecebimento: { _t: "Recebimento", Parcelas: parcelas },
      IndicadorPresencaComprador: { _t: "OperacaoPresencial", Codigo: 1, Descricao: "Operação presencial" },
      IndicadorOperacaoConsumidorFinal: cliente.IndicadorOperacaoConsumidorFinal || { _t: "ConsumidorFinal", Codigo: 1, Descricao: "Consumidor final" }
    };

    const result = await db.collection(COLLECTION_MOVIMENTACOES).insertOne(novaOS);
    return { numeroOs, insertedId: result.insertedId };
  }
}

module.exports = new DigisatService();