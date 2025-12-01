const Ticket = require('../models/Ticket');
const { startOfDay, startOfWeek, startOfMonth } = require('date-fns');

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    
    // Definindo os marcos de tempo
    const today = startOfDay(now);
    const thisWeek = startOfWeek(now, { weekStartsOn: 1 }); // 1 = Segunda-feira
    const thisMonth = startOfMonth(now);

    // Executa todas as consultas em paralelo para performance
    const [
      dailyCount,
      weeklyCount,
      monthlyCount,
      topClients,
      techStats
    ] = await Promise.all([
      // 1. Tickets de Hoje
      Ticket.countDocuments({ createdAt: { $gte: today } }),
      
      // 2. Tickets da Semana
      Ticket.countDocuments({ createdAt: { $gte: thisWeek } }),
      
      // 3. Tickets do Mês
      Ticket.countDocuments({ createdAt: { $gte: thisMonth } }),

      // 4. Top Clientes (Agregação complexa)
      Ticket.aggregate([
        {
          $group: {
            _id: "$client",
            ticketCount: { $sum: 1 },
            totalTime: { $sum: "$totalTime" }
          }
        },
        { $sort: { ticketCount: -1 } }, // Ordena do maior para o menor
        { $limit: 5 }, // Pega só os top 5
        { 
          $project: { 
            client: "$_id", 
            ticketCount: 1, 
            totalTime: 1, 
            _id: 0 
          } 
        }
      ]),

      // 5. Performance por Técnico
      Ticket.aggregate([
        {
          $group: {
            _id: "$technician",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        {
          $project: {
            technician: "$_id",
            count: 1,
            _id: 0
          }
        }
      ])
    ]);

    // Monta a resposta final
    res.json({
      dailyTickets: dailyCount,
      weeklyTickets: weeklyCount,
      monthlyTickets: monthlyCount,
      topClients,
      ticketsByTechnician: techStats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao gerar estatísticas' });
  }
};