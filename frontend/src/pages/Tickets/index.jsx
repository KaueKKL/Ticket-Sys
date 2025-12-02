import { useEffect, useState, useContext, useMemo } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, 
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, InputAdornment, Tooltip,
  Switch, FormControlLabel, Fab, Autocomplete, CircularProgress, Grid,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, useMediaQuery, useTheme,
  Card, CardContent, Divider
} from '@mui/material';
import { 
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, 
  Delete as DeleteIcon, CheckCircle, PauseCircle, PlayCircle,
  PersonSearch, FilterList, Comment, Send, CalendarToday, Person,
  ConfirmationNumberOutlined
} from '@mui/icons-material';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import throttle from 'lodash/throttle';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const TicketList = () => {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFinalized, setShowFinalized] = useState(false);
  
  // Inicia com 'Todos' para evitar warning, mas muda para o usuário logado no fetchUsers
  const [technicianFilter, setTechnicianFilter] = useState('Todos');
  
  const [open, setOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [formData, setFormData] = useState({ client: '', reason: '', solution: '', status: 'Em Andamento' });
  const [newNote, setNewNote] = useState('');
  const [loadingNote, setLoadingNote] = useState(false);
  const [clientOptions, setClientOptions] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { fetchTickets(); }, [technicianFilter]);

  // Carrega usuários e define o filtro padrão para o usuário logado
  const fetchUsers = async () => { 
    try { 
      const res = await api.get('/users'); 
      setUsers(res.data); 
      
      // Se o usuário atual estiver na lista, seleciona ele por padrão
      if (user?.name) {
        setTechnicianFilter(user.name);
      }
    } catch (e) {} 
  };

  const fetchTickets = async () => { setLoading(true); try { const res = await api.get(`/tickets?technician=${technicianFilter}`); setTickets(res.data); } catch (e) { toast.error('Erro ao carregar'); } finally { setLoading(false); } };

  const fetchClients = useMemo(() => throttle(async (req, cb) => {
    try { const res = await api.get(`/clients/search?q=${req.input}`); cb(res.data); } catch (e) { cb([]); }
  }, 500), []);

  useEffect(() => {
    let active = true;
    if (inputValue === '' || inputValue.length < 3) { setClientOptions(formData.client ? [formData.client] : []); return undefined; }
    setLoadingClients(true);
    fetchClients({ input: inputValue }, (res) => { if (active) { setClientOptions(res || []); setLoadingClients(false); } });
    return () => { active = false; };
  }, [inputValue, fetchClients, formData.client]);

  const handleOpen = (ticket = null) => {
    if (ticket) {
      setEditingTicket(ticket);
      setFormData({ client: ticket.client, reason: ticket.reason, solution: ticket.solution || '', status: ticket.status });
      setInputValue(typeof ticket.client === 'string' ? ticket.client : '');
    } else {
      setEditingTicket(null);
      setFormData({ client: '', reason: '', solution: '', status: 'Em Andamento' });
      setInputValue('');
    }
    setOpen(true);
    setNewNote('');
  };

  const handleClose = () => { setOpen(false); setEditingTicket(null); };

  const handleSubmit = async () => {
    try {
      const finalClientName = typeof formData.client === 'string' ? formData.client : formData.client?.name;
      if (!finalClientName || !formData.reason) return toast.warning('Dados incompletos');
      const payload = { ...formData, client: finalClientName };
      if (editingTicket) { await api.put(`/tickets/${editingTicket._id}`, payload); toast.success('Atualizado!'); } 
      else { await api.post('/tickets', payload); toast.success('Criado!'); }
      handleClose(); fetchTickets();
    } catch (e) { toast.error('Erro ao salvar'); }
  };

  const handleDelete = async (id) => { if (window.confirm('Excluir?')) { await api.delete(`/tickets/${id}`); fetchTickets(); } };

  // --- NOVA FUNÇÃO DE PLAY/PAUSE ---
  const handleToggleStatus = async (ticket, newStatus) => {
    try {
      await api.patch(`/tickets/${ticket._id}/status`, { status: newStatus });
      toast.success(`Status: ${newStatus}`);
      fetchTickets();
    } catch (error) {
      toast.error('Erro ao alterar status.');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setLoadingNote(true);
    try { const res = await api.post(`/tickets/${editingTicket._id}/notes`, { text: newNote }); setEditingTicket(res.data); setNewNote(''); } 
    catch (e) { toast.error('Erro nota'); } finally { setLoadingNote(false); }
  };

  // Helper para ID
  const getTicketNumber = (t) => t.ticketNumber || t._id.slice(-6).toUpperCase();

  const filtered = tickets.filter(t => (t.client.toLowerCase().includes(searchTerm.toLowerCase()) && (showFinalized ? true : t.status !== 'Finalizado')));
  const getStatusColor = (s) => s === 'Em Andamento' ? 'success' : s === 'Pausado' ? 'warning' : 'default';

  return (
    <Box sx={{ width: '100%', pb: 8 }}>
      {/* Header Responsivo */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Meus Tickets</Typography>
          <Typography variant="body2" color="text.secondary">Gerencie atendimentos</Typography>
        </Box>
        <Paper elevation={0} sx={{ width: { xs: '100%', md: 'auto' }, border: '1px solid #e2e8f0', borderRadius: 2, px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterList color="action" fontSize="small" /><Typography variant="body2" fontWeight="bold" noWrap>Ver de:</Typography>
          <FormControl variant="standard" sx={{ minWidth: 120, flexGrow: 1 }}>
            <Select value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)} disableUnderline sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.9rem' }}>
              <MenuItem value="Todos">Todos</MenuItem>
              {users.map(u => <MenuItem key={u._id} value={u.name}>{u.name === user.name ? 'Meus' : u.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Paper>
      </Box>

      {/* Busca e Filtros */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center' }}>
        <TextField fullWidth variant="outlined" placeholder="Buscar cliente..." size="small" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>) }} />
        <FormControlLabel control={<Switch checked={showFinalized} onChange={(e) => setShowFinalized(e.target.checked)} />} label={<Typography variant="body2" whiteSpace="nowrap">Histórico</Typography>} />
      </Paper>

      {/* Lista de Tickets */}
      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.length === 0 ? (
            <Typography align="center" color="text.secondary" sx={{ py: 4 }}>Nenhum ticket encontrado.</Typography>
          ) : (
            filtered.map((t) => (
              <Card key={t._id} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ lineHeight: 1.2 }}>{t.client}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                        <ConfirmationNumberOutlined sx={{ fontSize: 14 }} />
                        <Typography variant="caption" fontWeight="bold">#{getTicketNumber(t)}</Typography>
                        <Typography variant="caption">•</Typography>
                        <Typography variant="caption">{format(new Date(t.createdAt), 'dd/MM HH:mm')}</Typography>
                      </Box>
                    </Box>
                    <Chip label={t.status} color={getStatusColor(t.status)} size="small" sx={{ height: 24, fontSize: '0.7rem' }} />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', bgcolor: '#f8fafc', p: 1, borderRadius: 1 }}>
                    {t.reason}
                  </Typography>

                  <Divider sx={{ my: 1 }} />

                  {/* AÇÕES MOBILE: Play/Pause + Edit/Delete */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                       {t.status === 'Em Andamento' && (
                          <IconButton size="small" color="warning" onClick={() => handleToggleStatus(t, 'Pausado')}>
                            <PauseCircle />
                          </IconButton>
                       )}
                       {t.status === 'Pausado' && (
                          <IconButton size="small" color="success" onClick={() => handleToggleStatus(t, 'Em Andamento')}>
                            <PlayCircle />
                          </IconButton>
                       )}
                    </Box>
                    <Box>
                      <IconButton color="primary" size="small" onClick={() => handleOpen(t)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton color="error" size="small" onClick={() => handleDelete(t._id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        // Tabela Desktop
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflowX: 'auto', maxHeight: '65vh' }}>
          <Table stickyHeader sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell width={120}><strong>Nº Ticket</strong></TableCell>
                <TableCell><strong>Data</strong></TableCell>
                <TableCell><strong>Cliente</strong></TableCell>
                <TableCell><strong>Motivo</strong></TableCell>
                <TableCell><strong>Técnico</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="right"><strong>Ações</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t._id} hover>
                  <TableCell><Chip label={`#${getTicketNumber(t)}`} size="small" variant="outlined" sx={{ fontWeight: 'bold', bgcolor: 'white', fontSize: '0.75rem' }} /></TableCell>
                  <TableCell>{format(new Date(t.createdAt), 'dd/MM HH:mm')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t.client}</TableCell>
                  <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.reason}</TableCell>
                  <TableCell><Chip avatar={<Avatar sx={{ width: 24, height: 24, fontSize: '0.8rem' }}>{t.technician.charAt(0)}</Avatar>} label={t.technician} variant="outlined" size="small" /></TableCell>
                  <TableCell><Chip label={t.status} color={getStatusColor(t.status)} size="small" variant={t.status === 'Finalizado' ? 'outlined' : 'filled'} /></TableCell>
                  
                  {/* AÇÕES DESKTOP */}
                  <TableCell align="right">
                    {t.status === 'Em Andamento' && (
                      <Tooltip title="Pausar">
                        <IconButton color="warning" onClick={() => handleToggleStatus(t, 'Pausado')}><PauseCircle /></IconButton>
                      </Tooltip>
                    )}
                    {t.status === 'Pausado' && (
                      <Tooltip title="Retomar">
                        <IconButton color="success" onClick={() => handleToggleStatus(t, 'Em Andamento')}><PlayCircle /></IconButton>
                      </Tooltip>
                    )}
                    <IconButton color="primary" onClick={() => handleOpen(t)}><EditIcon /></IconButton>
                    <IconButton color="error" onClick={() => handleDelete(t._id)}><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Tooltip title="Novo" arrow placement="left"><Fab color="primary" onClick={() => handleOpen()} sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}><AddIcon /></Fab></Tooltip>

      {/* Modal Nova/Editar */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: '800', borderBottom: '1px solid #f1f5f9', bgcolor: isMobile ? 'primary.main' : 'white', color: isMobile ? 'white' : 'inherit' }}>
          {editingTicket ? `Ticket #${getTicketNumber(editingTicket)}` : 'Novo Atendimento'}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Grid container sx={{ height: editingTicket && !isMobile ? 550 : 'auto' }}>
            {/* Esquerda: Formulário */}
            <Grid size={{ xs: 12, md: editingTicket ? 7 : 12 }} sx={{ p: 3, borderRight: { md: '1px solid #f1f5f9' }, borderBottom: { xs: '1px solid #f1f5f9', md: 'none' } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Autocomplete freeSolo options={clientOptions} getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.name)} value={formData.client} disabled={!!editingTicket} onChange={(e, val) => setFormData({ ...formData, client: val })} onInputChange={(e, val) => setInputValue(val)} renderInput={(params) => (<TextField {...params} label="Cliente" InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><PersonSearch color="primary"/></InputAdornment>, endAdornment: (<>{loadingClients ? <CircularProgress size={20} /> : null}{params.InputProps.endAdornment}</>) }} />)} />
                <TextField label="Motivo" multiline rows={3} value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
                {editingTicket && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc' }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Status</InputLabel>
                      <Select value={formData.status} label="Status" onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                        <MenuItem value="Em Andamento"><PlayCircle color="success" sx={{ mr: 1 }}/> Em Andamento</MenuItem>
                        <MenuItem value="Pausado"><PauseCircle color="warning" sx={{ mr: 1 }}/> Pausado</MenuItem>
                        <MenuItem value="Aguardando Cliente"><PauseCircle color="action" sx={{ mr: 1 }}/> Aguardando Cliente</MenuItem>
                        <MenuItem value="Finalizado"><CheckCircle color="primary" sx={{ mr: 1 }}/> Finalizado</MenuItem>
                      </Select>
                    </FormControl>
                    {(formData.status === 'Finalizado' || formData.solution) && (<TextField label="Solução" fullWidth multiline rows={3} value={formData.solution} onChange={(e) => setFormData({ ...formData, solution: e.target.value })} color="success" focused={formData.status === 'Finalizado'} />)}
                  </Paper>
                )}
              </Box>
            </Grid>

            {/* Direita: Chat/Notas */}
            {editingTicket && (
              <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column', bgcolor: '#fafafa', height: { xs: 400, md: 'auto' } }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}><Typography variant="subtitle2" fontWeight="bold">Observações</Typography></Box>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                  {editingTicket.notes?.map((n, i) => (
                    <ListItem key={i} sx={{ bgcolor: 'white', mb: 1, borderRadius: 2, boxShadow: 1 }}><ListItemAvatar><Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>{n.createdBy.charAt(0)}</Avatar></ListItemAvatar><ListItemText primary={n.text} secondary={`${n.createdBy} • ${format(new Date(n.createdAt), 'dd/MM HH:mm')}`} /></ListItem>
                  ))}
                </Box>
                <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', bgcolor: 'white', display: 'flex', gap: 1 }}><TextField fullWidth size="small" placeholder="Nota..." value={newNote} onChange={(e) => setNewNote(e.target.value)} /><IconButton color="primary" onClick={handleAddNote} disabled={loadingNote}><Send /></IconButton></Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #f1f5f9' }}><Button onClick={handleClose}>Cancelar</Button><Button onClick={handleSubmit} variant="contained">Salvar</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default TicketList;