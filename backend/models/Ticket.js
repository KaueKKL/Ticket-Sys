const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  client: { 
    type: String, 
    required: [true, 'O nome do cliente é obrigatório'] 
  },
  reason: { 
    type: String, 
    required: [true, 'O motivo do chamado é obrigatório'] 
  },
  solution: { 
    type: String, 
    default: '' 
  },
  technician: { 
    type: String, 
    required: [true, 'O nome do técnico é obrigatório'] 
  },
  status: { 
    type: String, 
    enum: ['Em Andamento', 'Aguardando Cliente', 'Finalizado'],
    default: 'Em Andamento'
  },
  startDateTime: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  endDateTime: { 
    type: Date 
  },
  totalTime: { 
    type: Number, 
    default: 0 
  },
  statusHistory: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now }
  }],
  // --- NOVO CAMPO: OBSERVAÇÕES INTERNAS ---
  notes: [{
    text: { type: String, required: true },
    createdBy: { type: String, required: true }, // Nome do técnico que escreveu
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Hook para status inicial
TicketSchema.pre('save', async function() {
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.status,
      changedAt: this.startDateTime || new Date()
    });
  }
});

module.exports = mongoose.model('Ticket', TicketSchema);