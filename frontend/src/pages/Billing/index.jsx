import { useEffect, useState } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip, 
  CircularProgress
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
      // Filtra tickets FINALIZADOS (Corrigido)
      const closedTickets = res.data.filter(t => t.status === 'Finalizado');
      
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
    if (!window.confirm(`Confirma a geração de OS para o cliente ${ticket.client}?`)) return;

    setProcessingId(ticket._id);
    try {
      const res = await api.post('/billing/generate', { ticketId: ticket._id });
      toast.success(`OS Nº ${res.data.numero} gerada com sucesso!`);
      fetchTickets();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao gerar OS.');
    } finally {
      setProcessingId(null);
    }
  };

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
            <Typography color="text.secondary">Nenhum ticket finalizado disponível.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell><strong>Cliente</strong></TableCell>
                  <TableCell><strong>Assunto / Data</strong></TableCell>
                  <TableCell><strong>Tempo</strong></TableCell>
                  <TableCell><strong>Cobrança (Est.)</strong></TableCell>
                  <TableCell align="center"><strong>Status ERP</strong></TableCell>
                  <TableCell align="right"><strong>Ação</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket) => {
                  // --- LÓGICA DE PRECIFICAÇÃO (FRONTEND) ---
                  const minutos = ticket.totalTime || 0;
                  const horasReais = minutos / 60;
                  
                  // Regra: Arredondar para cima (Teto)
                  // Ex: 30min (0.5) -> 1h
                  // Ex: 1h10 (1.16) -> 2h
                  let horasCobradas = Math.ceil(horasReais);
                  if (horasCobradas < 1) horasCobradas = 1; // Mínimo 1h

                  const precoHora = 50.00; // Valor Base
                  const valorTotal = (horasCobradas * precoHora).toFixed(2);

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
                          label={formatTime(minutos)} 
                          size="small" 
                          variant="outlined" 
                        />
                        {/* Mostra a conversão se houver arredondamento */}
                        {horasCobradas > horasReais && (
                          <Typography variant="caption" display="block" color="error.main" sx={{ mt: 0.5 }}>
                            Arredondado: {horasCobradas}h
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell>
                        <Typography color="success.main" fontWeight="bold">
                          R$ {valorTotal}
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