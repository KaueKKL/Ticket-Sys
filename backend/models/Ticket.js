const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true },
  
  client: { type: String, required: true },
  technician: { type: String, required: true },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    // --- ADICIONADO 'Pausado' NA LISTA ---
    enum: ['Em Andamento', 'Aguardando Cliente', 'Pausado', 'Finalizado', 'Fechado'], 
    default: 'Em Andamento' 
  },
  solution: { type: String },
  notes: [{
    text: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  startDateTime: { type: Date, default: Date.now },
  endDateTime: { type: Date },
  totalTime: { type: Number, default: 0 },
  
  pauses: [{
    start: Date,
    end: Date,
    reason: String
  }],

  davNumero: { type: Number },
  davId: { type: String },
  billingStatus: { type: String, default: 'Pendente' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);