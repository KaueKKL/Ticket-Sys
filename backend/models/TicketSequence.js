const mongoose = require('mongoose');

const TicketSequenceSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('TicketSequence', TicketSequenceSchema);