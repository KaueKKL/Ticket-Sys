const connectLegacy = require('../config/legacyDb');
const SystemConfig = require('../models/SystemConfig');
const { 
  COLLECTION_PESSOAS, COLLECTION_MOVIMENTACOES, 
  COLLECTION_SEQUENCIAS, COLLECTION_OBJETOS 
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
    // Garante retorno Long
    return typeof doc.Contador === 'object' ? doc.Contador : new Long(doc.Contador);
  }

  async createServiceOrder(ticket) {
    // 1. Carregar Configurações
    const sysConfig = await SystemConfig.findOne({ key: 'digisat_main' });
    if (!sysConfig?.digisat?.empresaId || 
        !sysConfig?.digisat?.objetoId || 
        !sysConfig?.digisat?.produtoServicoId || 
        !sysConfig?.digisat?.operacaoFiscalId) {
      throw new Error('Configuração de Integração incompleta. Verifique as Configurações.');
    }

    const { empresaId, objetoId, produtoServicoId, operacaoFiscalId } = sysConfig.digisat;
    const EMPRESA_ID = new ObjectId(empresaId);
    const OBJETO_ID = new ObjectId(objetoId);
    const SERVICO_ID = new ObjectId(produtoServicoId);
    const OPERACAO_ID = new ObjectId(operacaoFiscalId);

    // 2. Conectar ao Legado
    const db = await connectLegacy();
    if (!db) throw new Error('Sem conexão com banco legado.');

    // 3. Buscar Entidades Necessárias
    const cliente = await db.collection(COLLECTION_PESSOAS).findOne({ Nome: ticket.client, Ativo: true });
    if (!cliente) throw new Error(`Cliente "${ticket.client}" não encontrado no ERP.`);

    const empresa = await db.collection(COLLECTION_PESSOAS).findOne({ _id: EMPRESA_ID });
    const objetoAtendimento = await db.collection(COLLECTION_OBJETOS).findOne({ _id: OBJETO_ID });
    const servico = await db.collection('ProdutosServicos').findOne({ _id: SERVICO_ID });
    const operacaoFiscal = await db.collection('OperacoesFiscais').findOne({ _id: OPERACAO_ID });

    // Busca dados financeiros padrão (Conta Caixa, Plano de Contas)
    // Isso é crítico: sem uma conta, o financeiro fica inválido
    const contaPadrao = await db.collection('Contas').findOne({ Ativo: true });
    const planoConta = await db.collection('PlanosConta').findOne({ Ativo: true }); // Pega o primeiro ativo como fallback
    
    if (!servico || !operacaoFiscal) throw new Error('Serviço ou Operação Fiscal não encontrados no ERP.');

    // 4. Preparar Dados Básicos
    const agora = new Date();
    const vencimento = new Date(agora); // Vencimento à vista
    const numeroOs = await this.getNextOsNumber(db, EMPRESA_ID);
    const versaoCSharp = generateCSharpVersion();

    // Snapshots Históricos (O segredo do seu JSON de exemplo)
    const pessoaHist = transformarPessoaParaHistorico(cliente);
    const empresaHist = transformarPessoaParaHistorico(empresa);
    
    // Adaptação do Serviço para Histórico
    const servicoHistorico = { ...servico };
    servicoHistorico._t = "ServicoHistorico";
    servicoHistorico.ProdutoServicoReferencia = servico._id;
    delete servicoHistorico._id;
    // Garante unidade de medida (fallback se não tiver)
    if (!servicoHistorico.UnidadeMedidaTributavel && servicoHistorico.UnidadeMedida) {
        servicoHistorico.UnidadeMedidaTributavel = servicoHistorico.UnidadeMedida;
    }

    // Cálculos
    // Se o ticket tiver 0 minutos, cobra 1 hora mínima (regra de negócio ajustável)
    const horasTrabalhadas = ticket.totalTime > 0 ? (ticket.totalTime / 60) : 1;
    // Busca preço na tabela da empresa ou usa padrão
    const precoVenda = 150.00; // TODO: Buscar da coleção 'ProdutosServicosEmpresa' se quiser refinar
    const valorTotal = parseFloat((horasTrabalhadas * precoVenda).toFixed(2));

    const item = {
        _t: "ItemDocumentoAuxiliarSaidaServico",
        ProdutoServicoEmpresaReferencia: new ObjectId(), // Gerar novo ID para relação se não tiver específico
        VendedorReferencia: new ObjectId("000000000000000000000000"), // Zero se não tiver vendedor
        TecnicoReferencia: new ObjectId("000000000000000000000000"),
        DataHora: agora,
        ProdutoServico: servicoHistorico,
        Cancelado: false,
        Quantidade: new Double(horasTrabalhadas),
        DecimaisQuantidade: 2,
        PrecoUnitario: new Double(precoVenda),
        DecimaisPrecoUnitario: 2,
        Numero: 1,
        Observacao: "",
        NCMNBS: {
            _t: "NBS",
            Codigo: "00000000",
            Descricao: "SERVICO NAO ESPECIFICADO",
            AliquotaNacional: 0.0,
            Fonte: "FONTE PROPRIA"
        },
        DescontoDigitado: 0.0,
        DescontoProporcional: 0.0,
        OutrasDespesasDigitado: 0.0,
        OutrasDespesasProporcional: 0.0,
        Frete: 0.0,
        Seguro: 0.0,
        OperacaoFiscal: operacaoFiscal,
        PIS: { _t: "PISCOFINSNaoTributadoComNaturezaReceitaSaida", CstPISCOFINS: { _t: "OperacaoIsentaDaContribuicao", Codigo: 7, Descricao: "Isenta" }, NaturezaReceita: { Codigo: 101, Descricao: "Outras" } },
        COFINS: { _t: "PISCOFINSNaoTributadoComNaturezaReceitaSaida", CstPISCOFINS: { _t: "OperacaoIsentaDaContribuicao", Codigo: 7, Descricao: "Isenta" }, NaturezaReceita: { Codigo: 101, Descricao: "Outras" } },
        ISS: {
            _t: "ISSNormal",
            CstIss: { _t: "TributadoIntegralmente", Codigo: 0, Descricao: "Tributada integralmente" },
            OperacaoFiscalReferencia: OPERACAO_ID,
            TipoTributacaoIss: 6,
            Percentual: 3.0,
            PercentualBaseCalculo: 100.0,
            TruncarValorImposto: false
        }
    };

    // 6. Montar PARCELA FINANCEIRA (O Recebimento)
    const parcelaId = new ObjectId();
    const parcela = {
        _t: "ParcelaRecebimento",
        _id: parcelaId,
        Referencia: new Long(Date.now()), 
        InformacoesPesquisa: ["gerado", "pelo", "sistema", ticket.client.toLowerCase().split(' ')[0]],
        Versao: versaoCSharp,
        Ativo: true,
        Ordem: 1,
        Descricao: "Gerado pelo Ticket-Sys",
        Observacao: `Ref. Ticket ${ticket._id}`,
        PessoaReferencia: cliente._id,
        Vencimento: vencimento,
        DataEmissao: agora,
        
        Historico: [{
            _t: "HistoricoAguardando",
            Valor: new Double(valorTotal),
            EspeciePagamento: { 
                _t: "EspeciePagamentoECF", 
                Codigo: 1, 
                Descricao: "Dinheiro", 
                EspecieRecebimento: { _t: "Dinheiro" } 
            },
            PlanoContaCodigoUnico: planoConta ? planoConta.CodigoUnico : "1",
            CentroCustoCodigoUnico: "1",
            ContaReferencia: contaPadrao ? contaPadrao._id : new ObjectId(),
            EmpresaReferencia: empresa._id,
            NomeUsuario: "Ticket-Sys",
            Data: agora,
            ChequeReferencia: new ObjectId("000000000000000000000000"),
            Editado: false
        }],
        Situacao: { _t: "Aguardando", Codigo: 6 },
        ContaReferencia: contaPadrao ? contaPadrao._id : new ObjectId(),
        EmpresaReferencia: empresa._id,
        NomeUsuario: "Ticket-Sys",
        Pessoa: pessoaHist,
        Juro: { _t: "JuroSimples", Codigo: 1, Descricao: "Simples", Percentual: 0.0, DiasCarencia: 0 },
        Multa: { Percentual: 0.0, DiasCarencia: 0 }
    };

    // 7. Montar DOCUMENTO FINAL (DAV-OS)
    const novaOS = {
        _id: new ObjectId(),
        _t: [
            "Movimentacao", 
            "DocumentoAuxiliar", 
            "DocumentoAuxiliarPrevisao", 
            "DocumentoAuxiliarVendaBase", 
            "DocumentoAuxiliarVendaOrdemServico"
        ],
        InformacoesPesquisa: [
            String(numeroOs),
            ticket.client.toLowerCase().split(' ')[0],
            ...(cliente.InformacoesPesquisa || [])
        ],
        Versao: versaoCSharp,
        Ativo: true,
        Numero: numeroOs,
        DataHoraEmissao: agora,
        Pessoa: pessoaHist,
        EmpresaReferencia: empresa._id,
        Empresa: empresaHist,
        OrigemMobile: false,
        OrigemPedirMenu: false,
        
        // Lista de Itens
        ItensBase: [item],
        
        // Financeiro
        PagamentoRecebimento: {
            _t: "Recebimento",
            Parcelas: [parcela]
        },

        // Dados de Controle da OS
        Situacao: { _t: ["SituacaoMovimentacao", "Aguardando"], Codigo: 1, Descricao: "Aguardando" },
        Historicos: [{
            SituacaoMovimentacao: { _t: ["SituacaoMovimentacao", "Aguardando"], Codigo: 1, Descricao: "Aguardando" },
            NomeUsuario: "Ticket-Sys",
            Observacao: "Gerado Automaticamente",
            DataHora: agora
        }],
        Notificar: true,
        DataUltimaConsultaSituacao: new Date("0001-01-01T00:00:00.000+0000"),
        Convertida: false,
        ModalidadeFrete: { _t: "SemFrete", Codigo: 9, Descricao: "Sem frete" },
        Observacao: `Ticket Origem: ${ticket.reason}\nSolução: ${ticket.solution || ''}`,
        DataHoraPrevisao: agora, // Previsão igual a emissão pois já está pronto
        
        // Objeto do Atendimento (Equipamento)
        Atendimento: { _t: "Interno", Codigo: 1, Descricao: "Interno" },
        Objetos: [{
            DataFinalGarantia: agora,
            PossuiGarantia: false,
            Defeito: ticket.reason,
            Diagnostico: ticket.solution || "Resolvido",
            Objeto: objetoAtendimento,
            // Campos personalizados copiados do JSON exemplo (Inicio/Fim)
            CamposPersonalizados: [
                {
                   _t: "CampoPersonalizadoDataHora",
                   // TODO: Idealmente buscaria o ID do TipoPersonalizado 'Inicio' no banco
                   // Aqui usamos uma estrutura genérica se não tivermos o ID exato configurado
                   ExibirImpressao: true,
                   Valor: ticket.startDateTime
                },
                {
                   _t: "CampoPersonalizadoDataHora",
                   ExibirImpressao: true,
                   Valor: ticket.endDateTime || agora
                }
            ]
        }],
        Animais: [],
        DocumentoFiscalProdutoReferencia: new ObjectId("000000000000000000000000"),
        StatusDocumentoAuxiliarOrdemServico: {
            Status: { _t: "Analise", Codigo: 16 },
            Observacao: "",
            DataHora: agora,
            Usuario: "Ticket-Sys"
        },
        DevolvidoLocacao: false,
        MovimentacoesReferenciadas: [],
        HistoricosDavDevolvido: [],
        TipoDavOs: { _t: "Normal", Codigo: 0, Descricao: "Normal" },
        DadosContrato: "",
        DataVencimentoContrato: new Date("0001-01-01T00:00:00.000+0000"),
        ImprimirPagamentoContrato: false,
        DataHoraRecebimento: agora,
        Prioridade: { _t: "Normal", Codigo: 2, Descricao: "Normal" },
        IndicadorPresencaComprador: { _t: "OperacaoPresencial", Codigo: 1, Descricao: "Operação presencial" },
        IndicadorOperacaoConsumidorFinal: { _t: "ConsumidorFinal", Codigo: 1, Descricao: "Consumidor final" }
    };

    // Inserção no Banco
    const result = await db.collection(COLLECTION_MOVIMENTACOES).insertOne(novaOS);

    return { 
        numeroOs, 
        insertedId: result.insertedId 
    };
  }
}

module.exports = new DigisatService();