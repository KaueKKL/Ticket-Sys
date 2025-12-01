const digisatService = require('../services/digisatService');
const Ticket = require('../models/Ticket');

exports.generateDav = async (req, res) => {
  try {
    const { ticketId } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket não encontrado.' });
    if (ticket.davNumero) return res.status(400).json({ message: `OS já gerada: Nº ${ticket.davNumero}` });

    const result = await digisatService.createServiceOrder(ticket);

    ticket.davNumero = Number(result.numeroOs.toString());
    ticket.davId = result.insertedId;
    ticket.billingStatus = 'Faturado';
    await ticket.save();

    res.json({ 
      message: 'OS gerada com sucesso!', 
      numero: ticket.davNumero, 
      id: result.insertedId 
    });

  } catch (error) {
    console.error('Erro ao gerar DAV:', error);
    res.status(500).json({ message: error.message || 'Erro interno no servidor.' });
  }
};