const Ticket = require('../models/Ticket');
const TicketSequence = require('../models/TicketSequence');

// Helper para calcular tempo líquido
const calculateNetTime = (ticket, endDate = new Date()) => {
  if (!ticket.startDateTime) return 0;
  const totalDurationMs = endDate - new Date(ticket.startDateTime);
  const totalPausedMs = (ticket.pauses || []).reduce((acc, pause) => {
      const start = new Date(pause.start);
      const end = pause.end ? new Date(pause.end) : endDate;
      return acc + (end - start);
  }, 0);
  const netMinutes = Math.floor((totalDurationMs - totalPausedMs) / 60000);
  return netMinutes > 0 ? netMinutes : 1;
};

exports.createTicket = async (req, res) => {
  try {
    const { client, reason, status, solution } = req.body;
    const today = new Date();
    const dateStr = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, '0') + today.getDate().toString().padStart(2, '0');
    const sequence = await TicketSequence.findOneAndUpdate({ date: dateStr }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    const newTicketNumber = `${dateStr}${sequence.seq.toString().padStart(4, '0')}`;

    const ticket = await Ticket.create({
      ticketNumber: newTicketNumber,
      client, reason, technician: req.user.name,
      status: status || 'Em Andamento', solution, createdBy: req.user._id,
      startDateTime: new Date(), totalTime: 0
    });
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar ticket.' });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const { technician, status, client, billingStatus } = req.query;
    let query = {};
    if (technician && technician !== 'Todos') query.technician = technician;
    if (status) query.status = status;
    if (client) query.client = { $regex: client, $options: 'i' };
    if (billingStatus === 'pending') { query.status = 'Finalizado'; query.davNumero = { $exists: false }; } 
    else if (billingStatus === 'billed') { query.davNumero = { $exists: true }; }
    const tickets = await Ticket.find(query).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Não encontrado' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ATUALIZAÇÃO AQUI: toggleTicketStatus aceitando 'reason'
exports.toggleTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // <--- Recebe o motivo
    const ticket = await Ticket.findById(id);

    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    const now = new Date();
    const PAUSE_STATUSES = ['Pausado', 'Aguardando Cliente'];
    const isGoingToPause = PAUSE_STATUSES.includes(status);
    const wasInPause = PAUSE_STATUSES.includes(ticket.status);

    // 1. Finalizando
    if (status === 'Finalizado') {
        if (wasInPause) {
            const lastPause = ticket.pauses[ticket.pauses.length - 1];
            if (lastPause && !lastPause.end) lastPause.end = now;
        }
        ticket.endDateTime = now;
        ticket.status = 'Finalizado';
        ticket.totalTime = calculateNetTime(ticket, now);
    } 
    // 2. Entrando em Pausa
    else if (isGoingToPause && !wasInPause) {
        ticket.pauses.push({ 
            start: now, 
            reason: reason || status // <--- Salva o motivo ou o nome do status
        });
        ticket.status = status;
    }
    // 3. Retomando
    else if (!isGoingToPause && wasInPause) {
        const lastPause = ticket.pauses[ticket.pauses.length - 1];
        if (lastPause && !lastPause.end) lastPause.end = now;
        ticket.status = 'Em Andamento'; // Força voltar para Andamento ao sair de pausa
    }
    else {
        ticket.status = status;
    }

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTicket = async (req, res) => {
    // Reutiliza a lógica do toggle para manter consistência se mudar status pelo modal
    if (req.body.status) {
        return exports.toggleTicketStatus(req, res);
    }
    // Se for só edição de texto
    try {
        const { client, reason, solution } = req.body;
        const ticket = await Ticket.findById(req.params.id);
        if (client) ticket.client = client;
        if (reason) ticket.reason = reason;
        if (solution) ticket.solution = solution;
        await ticket.save();
        res.json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.addTicketNote = async (req, res) => {
  try {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);
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
    res.json({ message: 'Removido' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};