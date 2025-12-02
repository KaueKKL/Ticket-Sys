const Ticket = require('../models/Ticket');
const TicketSequence = require('../models/TicketSequence');

exports.createTicket = async (req, res) => {
  try {
    const { client, reason, status, solution } = req.body;

    // 1. Gera a data invertida (YYYYMMDD)
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0');
    
    // 2. Busca e incrementa a sequência do dia
    const sequence = await TicketSequence.findOneAndUpdate(
      { date: dateStr },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    // 3. Formata o número final (Data + Sequência de 4 dígitos)
    const seqStr = sequence.seq.toString().padStart(4, '0');
    const newTicketNumber = `${dateStr}${seqStr}`;

    const ticket = await Ticket.create({
      ticketNumber: newTicketNumber,
      client,
      reason,
      technician: req.user.name,
      status: status || 'Em Andamento',
      solution,
      createdBy: req.user._id,
      startDateTime: new Date(),
      totalTime: 0
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Erro create ticket:', error);
    res.status(400).json({ message: 'Erro ao criar ticket.' });
  }
};

// @desc    Lista tickets
exports.getTickets = async (req, res) => {
  try {
    const { technician, status, client, billingStatus } = req.query;
    let query = {};

    if (technician && technician !== 'Todos') query.technician = technician;
    if (status) query.status = status;
    if (client) query.client = { $regex: client, $options: 'i' };

    // Filtros de Faturamento
    if (billingStatus === 'pending') {
      query.status = 'Finalizado';
      query.davNumero = { $exists: false };
    } else if (billingStatus === 'billed') {
      query.davNumero = { $exists: true };
    }

    const tickets = await Ticket.find(query).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Atualiza ticket (Correção do Erro 400)
exports.updateTicket = async (req, res) => {
  try {
    const { status, solution, client, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    if (client) ticket.client = client;
    if (reason) ticket.reason = reason;
    if (solution) ticket.solution = solution;

    // Mudança de Status
    if (status && status !== ticket.status) {
      ticket.status = status;

      // Se finalizou, calcula tempo automaticamente (Fim - Início)
      if (status === 'Finalizado') {
        const end = new Date();
        ticket.endDateTime = end;
        
        if (ticket.startDateTime) {
          const diffMs = end - new Date(ticket.startDateTime);
          const minutes = Math.floor(diffMs / 60000);
          // Garante pelo menos 1 min se for muito rápido, ou mantém o que já tinha se for maior
          ticket.totalTime = Math.max(minutes, ticket.totalTime || 0); 
        }
      }
    }

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Erro update ticket:', error);
    res.status(400).json({ message: error.message });
  }
};

exports.addTicketNote = async (req, res) => {
  try {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    ticket.notes.push({ text, createdBy: req.user.name, createdAt: new Date() });
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ticket removido com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};