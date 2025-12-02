const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true, 
    default: 'digisat_main' 
  },
  digisat: {
    empresaId: { type: String, default: '' }, 
    objetoId: { type: String, default: '' },
    campoInicioId: { type: String, default: '' },
    campoFimId: { type: String, default: '' },
    produtoServicoId: { type: String, default: '' }, 
    operacaoFiscalId: { type: String, default: '' },
  },
  // --- NOVO: Configuração de Expediente ---
  businessHours: {
    start: { type: String, default: '07:30' },
    end: { type: String, default: '17:30' },
    lunchStart: { type: String, default: '12:00' },
    lunchEnd: { type: String, default: '13:12' }
  },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);