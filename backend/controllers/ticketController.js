const Ticket = require('../models/Ticket');

// ... (calculateTotalMinutes e createTicket mantidos iguais) ...
// Função auxiliar para calcular tempo líquido (excluindo pausas)
const calculateTotalMinutes = (history, finalDate) => {
  let totalMinutes = 0;
  for (let i = 0; i < history.length; i++) {
    const currentEntry = history[i];
    const nextEntry = history[i + 1];
    if (currentEntry.status === 'Em Andamento') {
      const startTime = new Date(currentEntry.changedAt);
      const endTime = nextEntry 
        ? new Date(nextEntry.changedAt) 
        : (finalDate ? new Date(finalDate) : new Date());
      const diffMs = endTime - startTime;
      totalMinutes += Math.floor(diffMs / 1000 / 60);
    }
  }
  return totalMinutes;
};

exports.createTicket = async (req, res) => {
  try {
    const technicianName = req.user.name; 
    const ticketData = { ...req.body, technician: technicianName };
    const ticket = new Ticket(ticketData);
    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// --- ATUALIZAÇÃO IMPORTANTE AQUI ---
exports.getTickets = async (req, res) => {
  try {
    const { technician, status, client, billingStatus } = req.query;
    let query = {};

    // Filtro por Técnico
    if (technician && technician !== 'Todos') {
      query.technician = technician;
    }
    
    // Filtro por Status (Ex: 'Finalizado')
    if (status) {
      query.status = status;
    }

    // Filtro por Nome do Cliente (Busca parcial)
    if (client) {
      query.client = { $regex: client, $options: 'i' };
    }

    // Filtro de Faturamento (Novo)
    if (billingStatus === 'pending') {
      // Finalizado mas SEM número de DAV
      query.status = 'Finalizado';
      query.davNumero = { $exists: false };
    } else if (billingStatus === 'billed') {
      // Tem número de DAV
      query.davNumero = { $exists: true };
    }

    const tickets = await Ticket.find(query).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ... (getTicketById, updateTicket, addTicketNote, deleteTicket mantidos iguais) ...
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const { status, solution, client, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    if (client) ticket.client = client;
    if (reason) ticket.reason = reason;

    if (status && status !== ticket.status) {
      ticket.statusHistory.push({ status: status, changedAt: new Date() });
      ticket.status = status;
    }

    if (status === 'Finalizado') {
      ticket.endDateTime = new Date();
      ticket.solution = solution || ticket.solution;
      ticket.totalTime = calculateTotalMinutes(ticket.statusHistory, ticket.endDateTime);
    } else if (solution) {
       ticket.solution = solution;
    }

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
    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    const newNote = {
      text,
      createdBy: req.user.name,
      createdAt: new Date()
    };

    ticket.notes.push(newNote);
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