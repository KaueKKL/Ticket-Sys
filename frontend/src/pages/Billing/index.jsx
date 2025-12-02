import { useEffect, useState } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip, 
  CircularProgress, IconButton, Tooltip 
} from '@mui/material';
import { 
  ReceiptLong, CheckCircle, MonetizationOn, AccessTime 
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../services/api';
import dayjs from 'dayjs';

const Billing = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/tickets');
      // Filtra apenas tickets FECHADOS para faturamento
      const closedTickets = res.data.filter(t => t.status === 'Finalizado');
      // Ordena: Primeiro os sem OS (pendentes), depois os mais recentes
      closedTickets.sort((a, b) => {
        if (a.davNumero && !b.davNumero) return 1;
        if (!a.davNumero && b.davNumero) return -1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
      setTickets(closedTickets);
    } catch (error) {
      toast.error('Erro ao carregar tickets.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOS = async (ticket) => {
    if (!window.confirm(`Confirma a geração de OS para o cliente ${ticket.client}? Isso enviará os dados para o ERP.`)) return;

    setProcessingId(ticket._id);
    try {
      const res = await api.post('/billing/generate', { ticketId: ticket._id });
      toast.success(`OS Nº ${res.data.numero} gerada com sucesso!`);
      fetchTickets(); // Recarrega a lista
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao gerar OS.');
    } finally {
      setProcessingId(null);
    }
  };

  // Formata minutos para HH:mm
  const formatTime = (minutes) => {
    if (!minutes) return '00:00';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <Box sx={{ width: '100%', pb: 5 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <MonetizationOn fontSize="large" color="primary" />
        <Typography variant="h4" fontWeight="800" color="primary.main">
          Faturamento (Geração de OS)
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : tickets.length === 0 ? (
          <Box p={4} textAlign="center">
            <Typography color="text.secondary">Nenhum ticket fechado disponível para faturamento.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell><strong>Cliente</strong></TableCell>
                  <TableCell><strong>Assunto / Data</strong></TableCell>
                  <TableCell><strong>Tempo</strong></TableCell>
                  <TableCell><strong>Valor Est. (R$)</strong></TableCell>
                  <TableCell align="center"><strong>Status ERP</strong></TableCell>
                  <TableCell align="right"><strong>Ação</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket) => {
                  // Cálculo Estimado Visual (Apenas visual, o backend recalcula)
                  const horas = ticket.totalTime ? ticket.totalTime / 60 : 0;
                  const valorEstimado = (horas * 150).toFixed(2); // R$ 150/h base

                  return (
                    <TableRow key={ticket._id} hover>
                      <TableCell>
                        <Typography fontWeight="bold">{ticket.client}</Typography>
                        <Typography variant="caption" color="text.secondary">ID: {ticket._id.slice(-6)}</Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">{ticket.reason}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(ticket.createdAt).format('DD/MM/YYYY HH:mm')}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip 
                          icon={<AccessTime />} 
                          label={formatTime(ticket.totalTime)} 
                          size="small" 
                          variant="outlined" 
                        />
                      </TableCell>

                      <TableCell>
                        <Typography color="success.main" fontWeight="bold">
                          R$ {valorEstimado}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        {ticket.davNumero ? (
                          <Chip 
                            icon={<CheckCircle />} 
                            label={`OS Nº ${ticket.davNumero}`} 
                            color="success" 
                            variant="filled" 
                          />
                        ) : (
                          <Chip label="Pendente" color="warning" size="small" variant="outlined" />
                        )}
                      </TableCell>

                      <TableCell align="right">
                        {ticket.davNumero ? (
                          <Button disabled size="small">Faturado</Button>
                        ) : (
                          <Button 
                            variant="contained" 
                            color="primary" 
                            startIcon={<ReceiptLong />}
                            disabled={processingId === ticket._id}
                            onClick={() => handleGenerateOS(ticket)}
                          >
                            {processingId === ticket._id ? 'Gerando...' : 'Gerar OS'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default Billing;