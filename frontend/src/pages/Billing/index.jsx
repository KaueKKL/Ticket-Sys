import { useEffect, useState, useMemo } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, 
  TextField, InputAdornment, Button, Tabs, Tab, CircularProgress, 
  Card, CardContent, Divider, useMediaQuery, useTheme
} from '@mui/material';
import { 
  Search as SearchIcon, ReceiptLong, CheckCircle, Description,
  HourglassEmpty
} from '@mui/icons-material';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import throttle from 'lodash/throttle';
import api from '../../services/api';

const Billing = () => {
  const [tabValue, setTabValue] = useState(0); // 0 = Pendente, 1 = Faturado
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingId, setGeneratingId] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchTickets();
  }, [tabValue]);

  const debouncedSearch = useMemo(() => throttle((val) => {
    fetchTickets(val);
  }, 1000), [tabValue]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    debouncedSearch(e.target.value);
  };

  const fetchTickets = async (search = searchTerm) => {
    setLoading(true);
    try {
      const statusBilling = tabValue === 0 ? 'pending' : 'billed';
      const params = { billingStatus: statusBilling, client: search };
      const res = await api.get('/tickets', { params });
      setTickets(res.data);
    } catch (error) {
      toast.error('Erro ao carregar tickets.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDav = async (ticket) => {
    if (!window.confirm(`Confirma a geração da OS para ${ticket.client}?`)) return;

    setGeneratingId(ticket._id);
    try {
      const res = await api.post('/billing/generate', { ticketId: ticket._id });
      
      toast.success(`OS Nº ${res.data.numero} gerada com sucesso!`);
      
      // Remove o ticket da lista visualmente para feedback instantâneo
      setTickets(prev => prev.filter(t => t._id !== ticket._id));
      
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao gerar OS.');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <Box sx={{ width: '100%', pb: 8 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="800" color="primary.main">Faturamento</Typography>
        <Typography variant="body2" color="text.secondary">Gerencie a emissão de OS e cobranças</Typography>
      </Box>

      <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'transparent' }}>
        <Tabs value={tabValue} onChange={(e, v) => { setTabValue(v); setSearchTerm(''); }} variant={isMobile ? "fullWidth" : "standard"}>
          <Tab icon={<HourglassEmpty />} iconPosition="start" label="Pendentes" />
          <Tab icon={<CheckCircle />} iconPosition="start" label="Histórico Faturado" />
        </Tabs>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
        <TextField fullWidth variant="outlined" placeholder="Buscar cliente ou ticket..." size="small" value={searchTerm} onChange={handleSearchChange} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>) }} />
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : tickets.length === 0 ? (
        <Box textAlign="center" py={6} bgcolor="#f8fafc" borderRadius={3} border="1px dashed #e2e8f0">
          <Typography color="text.secondary">Nenhum ticket encontrado nesta categoria.</Typography>
        </Box>
      ) : isMobile ? (
        <Box display="flex" flexDirection="column" gap={2}>
          {tickets.map((t) => (
            <Card key={t._id} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography fontWeight="bold" variant="subtitle1">{t.client}</Typography>
                  <Chip label={`${t.totalTime || 0} min`} size="small" color="primary" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, bgcolor: '#f8fafc', p: 1, borderRadius: 1 }}>
                  {t.reason}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(t.createdAt), 'dd/MM/yy HH:mm')} • {t.technician}
                  </Typography>
                  {tabValue === 0 ? (
                    <Button 
                      variant="contained" 
                      color="secondary" 
                      size="small" 
                      startIcon={generatingId === t._id ? <CircularProgress size={16} color="inherit"/> : <ReceiptLong />}
                      onClick={() => handleGenerateDav(t)}
                      disabled={generatingId === t._id}
                    >
                      Gerar OS
                    </Button>
                  ) : (
                    <Chip label={`OS ${t.davNumero}`} color="success" size="small" icon={<Description />} />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell><strong>Data</strong></TableCell>
                <TableCell><strong>Cliente</strong></TableCell>
                <TableCell><strong>Serviço</strong></TableCell>
                <TableCell><strong>Técnico</strong></TableCell>
                <TableCell align="center"><strong>Tempo</strong></TableCell>
                <TableCell align="right"><strong>Ação</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t._id} hover>
                  <TableCell>{format(new Date(t.createdAt), 'dd/MM HH:mm')}</TableCell>
                  <TableCell fontWeight="bold">{t.client}</TableCell>
                  <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.reason}</TableCell>
                  <TableCell>{t.technician}</TableCell>
                  <TableCell align="center">
                    <Chip label={`${t.totalTime || 0} min`} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    {tabValue === 0 ? (
                      <Button 
                        variant="contained" 
                        color="secondary" 
                        size="small" 
                        startIcon={generatingId === t._id ? <CircularProgress size={16} color="inherit"/> : <ReceiptLong />}
                        onClick={() => handleGenerateDav(t)}
                        disabled={generatingId === t._id}
                      >
                        Gerar OS
                      </Button>
                    ) : (
                      <Chip label={`OS Nº ${t.davNumero}`} color="success" icon={<Description style={{color:'white'}}/>} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default Billing;