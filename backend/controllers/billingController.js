const digisatService = require('../services/digisatService');
const Ticket = require('../models/Ticket');

exports.generateDav = async (req, res) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
        return res.status(400).json({ message: 'ID do Ticket é obrigatório.' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
        return res.status(404).json({ message: 'Ticket não encontrado.' });
    }

    // Verifica se já foi faturado para evitar duplicidade
    if (ticket.davNumero) {
        return res.status(400).json({ message: `Este ticket já possui a OS Nº ${ticket.davNumero} gerada.` });
    }

    // Chama o serviço pesado
    const result = await digisatService.createServiceOrder(ticket);

    // Atualiza o Ticket com o número da OS gerada
    ticket.davNumero = Number(result.numeroOs.toString()); // Converte Long para Number js simples
    ticket.davId = result.insertedId;
    ticket.billingStatus = 'Faturado'; // Flag visual
    await ticket.save();

    res.status(200).json({ 
      message: 'Ordem de Serviço gerada com sucesso!', 
      numero: ticket.davNumero,
      id: result.insertedId
    });

  } catch (error) {
    console.error('FATAL: Erro ao gerar OS:', error);
    // Retorna erro detalhado para o frontend
    res.status(500).json({ message: error.message || 'Erro interno ao comunicar com o ERP.' });
  }
};