const { ObjectId, Long, Double } = require('mongodb-legacy');

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
exports.transformarPessoaParaHistorico = (doc) => {
  if (!doc) return null;

  const historico = { ...doc };

  historico.PessoaReferencia = doc._id;
  delete historico._id;

  // Define o tipo histórico correto
  const isFisica = doc._t && (doc._t.includes("Fisica") || doc._t === "Fisica");
  
  if (isFisica) {
    historico._t = "FisicaHistorico";
  } else {
    historico._t = "JuridicaHistorico";
    if (historico.Cnae) {
        delete historico.Cnae; 
    }
  }
  delete historico.Imagem;
  delete historico.Biometrias;

  return historico;
};