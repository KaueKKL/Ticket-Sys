const Ticket = require('../models/Ticket');
const TicketSequence = require('../models/TicketSequence'); // Necessário para o número 2025...

// @desc    Cria novo ticket com numeração sequencial diária
// @route   POST /api/tickets
exports.createTicket = async (req, res) => {
  try {
    const { client, reason, status, solution } = req.body;

    // 1. Geração do Número Sequencial (YYYYMMDDxxxx)
    const today = new Date();
    const dateStr = today.toISOString().slice(0,10).replace(/-/g, ''); // "20251202"
    
    const sequence = await TicketSequence.findOneAndUpdate(
      { date: dateStr },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const seqStr = sequence.seq.toString().padStart(4, '0');
    const newTicketNumber = `${dateStr}${seqStr}`;

    // 2. Criação do Ticket
    const ticket = await Ticket.create({
      ticketNumber: newTicketNumber,
      client,
      reason,
      technician: req.user.name,
      status: status || 'Em Andamento',
      solution,
      createdBy: req.user._id,
      startDateTime: new Date(), // Marca o início agora
      totalTime: 0
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    res.status(400).json({ message: 'Erro ao criar ticket. Verifique os dados.' });
  }
};

// @desc    Lista tickets com filtros
// @route   GET /api/tickets
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

// @desc    Busca um ticket
// @route   GET /api/tickets/:id
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Atualiza ticket (Status, Solução, Tempo)
// @route   PUT /api/tickets/:id
exports.updateTicket = async (req, res) => {
  try {
    const { status, solution, client, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    // Atualiza campos básicos
    if (client) ticket.client = client;
    if (reason) ticket.reason = reason;
    if (solution) ticket.solution = solution;

    // Lógica de mudança de status
    if (status && status !== ticket.status) {
      ticket.status = status;

      // Se finalizou, calcula o tempo total
      if (status === 'Finalizado') {
        const end = new Date();
        ticket.endDateTime = end;
        
        // Cálculo Simples: Fim - Início (em minutos)
        if (ticket.startDateTime) {
          const diffMs = end - new Date(ticket.startDateTime);
          const minutes = Math.floor(diffMs / 60000);
          ticket.totalTime = minutes > 0 ? minutes : 1; // Mínimo 1 minuto se for muito rápido
        }
      }
    }

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Erro update:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Adiciona nota
// @route   POST /api/tickets/:id/notes
exports.addTicketNote = async (req, res) => {
  try {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    ticket.notes.push({
      text,
      createdBy: req.user.name,
      createdAt: new Date()
    });

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Deleta ticket
// @route   DELETE /api/tickets/:id
exports.deleteTicket = async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ticket removido com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};