const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true, 
    default: 'digisat_main' 
  },
  digisat: {
    // Dados da Matriz e Objeto (Equipamento padrão)
    empresaId: { type: String, default: '' }, 
    objetoId: { type: String, default: '' },
    
    // Campos de Data/Hora personalizados (Opcionais)
    campoInicioId: { type: String, default: '' },
    campoFimId: { type: String, default: '' },

    // --- NOVOS CAMPOS FINANCEIROS OBRIGATÓRIOS ---
    // O ID do serviço "Hora Técnica" no ERP
    produtoServicoId: { type: String, default: '' }, 
    // O ID da Operação Fiscal (CFOP) de Saída de Serviço (Ex: 5.933)
    operacaoFiscalId: { type: String, default: '' },
  },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);