const { ObjectId, Long, Double } = require('mongodb-legacy');

// Gera a versão no formato TimeSpan do .NET (Dias desde 0001-01-01)
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

// Cria o "Snapshot" (Cópia estática) dos dados da pessoa para o cabeçalho da OS
exports.transformarPessoaParaHistorico = (doc) => {
  const historico = { ...doc, PessoaReferencia: doc._id };
  delete historico._id;

  const carteira = doc.Carteira || {};
  const isFisica = doc._t && doc._t.some(t => t.includes("Fisica"));

  if (isFisica) {
    historico._t = "FisicaHistorico";
    historico.Documento = doc.Cpf;
  } else {
    historico._t = "JuridicaHistorico";
    historico.Documento = doc.Cnpj;
    historico.Ie = carteira.Ie?.Numero;
  }

  if (historico.Cnae || historico.CNAE) {
    historico.Cnae = (historico.Cnae || historico.CNAE).replace(/\D/g, "");
    delete historico.CNAE;
  }

  historico.EnderecoPrincipal = carteira.EnderecoPrincipal;
  historico.TelefonePrincipal = carteira.TelefonePrincipal?.Numero;
  historico.EmailPrincipal = carteira.EmailPrincipal?.Endereco;

  // Limpeza de campos desnecessários para o histórico
  const camposParaRemover = [
    'Cpf', 'Cnpj', 'Carteira', 'Imagem', 'NomePai', 'NomeMae', 
    'Genero', 'DataNascimento', 'DiaNascimento', 'MesNascimento', 
    'Apelido', 'Profissao', 'Naturalidade', 'Nacionalidade', 
    'Cnh', 'Rg', 'Vendedor', 'Tecnico', 'ColaboradorIndustria', 
    'PessoasAutorizadas', 'DiaAcerto', 'NaoProtestar', 'Fornecedor'
  ];
  
  camposParaRemover.forEach(campo => delete historico[campo]);

  return historico;
};