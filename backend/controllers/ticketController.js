const Ticket = require('../models/Ticket');
const TicketSequence = require('../models/TicketSequence');

const calculateNetTime = (ticket, endDate = new Date()) => {
  if (!ticket.startDateTime) return 0;
  
  const totalDurationMs = endDate - new Date(ticket.startDateTime);
  
  const totalPausedMs = (ticket.pauses || []).reduce((acc, pause) => {
      const start = new Date(pause.start);
      const end = pause.end ? new Date(pause.end) : endDate;
      return acc + (end - start);
  }, 0);

  const netMinutes = Math.floor((totalDurationMs - totalPausedMs) / 60000);
  return netMinutes > 0 ? netMinutes : 0;
};

// @desc    Cria novo ticket
exports.createTicket = async (req, res) => {
  try {
    const { client, reason, status, solution } = req.body;

    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0');
    
    const sequence = await TicketSequence.findOneAndUpdate(
      { date: dateStr }, { $inc: { seq: 1 } }, { new: true, upsert: true }
    );

    const newTicketNumber = `${dateStr}${sequence.seq.toString().padStart(4, '0')}`;

    const ticket = await Ticket.create({
      ticketNumber: newTicketNumber,
      client, reason, technician: req.user.name,
      status: status || 'Em Andamento',
      solution, createdBy: req.user._id,
      startDateTime: new Date(), totalTime: 0
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error(error);
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
    if (!ticket) return res.status(404).json({ message: 'Não encontrado' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Atualiza ticket (Edição Geral)
exports.updateTicket = async (req, res) => {
  try {
    const { status, solution, client, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    if (client) ticket.client = client;
    if (reason) ticket.reason = reason;
    if (solution) ticket.solution = solution;

    // Se mudou status via edição manual (Modal)
    if (status && status !== ticket.status) {
        const now = new Date();
        
        // Lógica Inteligente de Pausa via Modal
        const isPause = ['Pausado', 'Aguardando Cliente'].includes(status);
        const wasPause = ['Pausado', 'Aguardando Cliente'].includes(ticket.status);

        if (status === 'Finalizado') {
            // Fecha pausas abertas antes de finalizar
            if (wasPause) {
                const lastPause = ticket.pauses[ticket.pauses.length - 1];
                if (lastPause && !lastPause.end) lastPause.end = now;
            }
            ticket.endDateTime = now;
            ticket.totalTime = calculateNetTime(ticket, now);
        } 
        else if (isPause && !wasPause) {
            ticket.pauses.push({ start: now, reason: status });
        }
        else if (!isPause && wasPause) {
            const lastPause = ticket.pauses[ticket.pauses.length - 1];
            if (lastPause && !lastPause.end) lastPause.end = now;
        }

        ticket.status = status;
    }

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Controle de Play/Pause (Botões Rápidos)
exports.toggleTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const ticket = await Ticket.findById(id);

    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado' });

    const now = new Date();
    
    // Definição de status de "Parada"
    const isPauseTarget = ['Pausado', 'Aguardando Cliente'].includes(status);
    const isPauseCurrent = ['Pausado', 'Aguardando Cliente'].includes(ticket.status);

    // 1. Iniciando uma Pausa (Pausado ou Aguardando)
    if (isPauseTarget && !isPauseCurrent) {
       ticket.pauses.push({ start: now, reason: status });
       ticket.status = status;
    }
    
    // 2. Retomando (Play)
    else if (status === 'Em Andamento' && isPauseCurrent) {
       const lastPause = ticket.pauses[ticket.pauses.length - 1];
       if (lastPause && !lastPause.end) {
           lastPause.end = now;
       }
       ticket.status = 'Em Andamento';
    }

    // 3. Finalizando
    else if (status === 'Finalizado') {
       if (isPauseCurrent) {
           const lastPause = ticket.pauses[ticket.pauses.length - 1];
           if (lastPause && !lastPause.end) lastPause.end = now;
       }
       ticket.endDateTime = now;
       ticket.status = 'Finalizado';
       
       // Calcula tempo final descontando pausas
       ticket.totalTime = calculateNetTime(ticket, now);
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