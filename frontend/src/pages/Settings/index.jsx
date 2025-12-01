import { useEffect, useState, useContext } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Switch, Avatar, useMediaQuery, useTheme, Container,
  Card, CardContent, Divider
} from '@mui/material';
import { 
  Add as AddIcon, Person as PersonIcon, AdminPanelSettings, Badge,
  Edit as EditIcon, Delete as DeleteIcon 
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const Settings = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', isAdmin: false });
  
  const { user } = useContext(AuthContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => { try { const res = await api.get('/users'); setUsers(res.data); } catch (e) { toast.error('Erro ao listar usuários'); } };
  
  const handleOpen = (userToEdit = null) => {
    if (userToEdit) {
      setEditingId(userToEdit._id);
      setFormData({ name: userToEdit.name, email: userToEdit.email, password: '', isAdmin: userToEdit.isAdmin });
    } else {
      setEditingId(null);
      setFormData({ name: '', email: '', password: '', isAdmin: false });
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingId(null); };
  
  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.email) return toast.warning('Nome e Email são obrigatórios');
      if (!editingId && !formData.password) return toast.warning('Senha é obrigatória para novos usuários');

      if (editingId) {
        await api.put(`/users/${editingId}`, formData);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        await api.post('/users', formData);
        toast.success('Usuário criado com sucesso!');
      }
      handleClose(); fetchUsers();
    } catch (e) { 
      toast.error(e.response?.data?.message || 'Erro ao salvar'); 
    }
  };

  const handleDelete = async (id) => {
    if (id === user._id) return toast.error('Você não pode excluir seu próprio usuário.');
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try { await api.delete(`/users/${id}`); toast.success('Usuário excluído.'); fetchUsers(); } 
      catch (e) { toast.error('Erro ao excluir.'); }
    }
  };

  return (
    <Box sx={{ width: '100%', pb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" color="primary.main">Usuários</Typography>
          <Typography variant="body2" color="text.secondary">Gerencie a equipe</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} fullWidth={isMobile}>Novo Usuário</Button>
      </Box>

      {isMobile ? (
        <Box display="flex" flexDirection="column" gap={2}>
          {users.map((u) => (
            <Card key={u._id} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: u.isAdmin ? 'primary.main' : 'secondary.main' }}>{u.name[0]}</Avatar>
                    <Box><Typography fontWeight="bold">{u.name}</Typography><Typography variant="caption">{u.email}</Typography></Box>
                  </Box>
                  <Box>
                    <IconButton size="small" color="primary" onClick={() => handleOpen(u)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(u._id)}><DeleteIcon /></IconButton>
                  </Box>
                </Box>
                <Divider />
                <Box mt={1} display="flex" justifyContent="space-between"><Chip label={u.isAdmin ? "Admin" : "Técnico"} size="small" /><Chip label="Ativo" color="success" size="small" /></Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}><TableRow><TableCell>Usuário</TableCell><TableCell>Email</TableCell><TableCell>Permissão</TableCell><TableCell align="right">Ações</TableCell></TableRow></TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u._id} hover>
                  <TableCell><Box display="flex" gap={2} alignItems="center"><Avatar sx={{ width: 30, height: 30, fontSize: 14, bgcolor: u.isAdmin ? 'primary.main' : 'secondary.main' }}>{u.name[0]}</Avatar> {u.name}</Box></TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Chip label={u.isAdmin ? "Admin" : "Técnico"} color={u.isAdmin ? "primary" : "default"} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => handleOpen(u)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(u._id)}><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={handleClose} fullScreen={isMobile} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Editar' : 'Novo'}</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={3} pt={1}>
            <TextField label="Nome" fullWidth value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <TextField label="Email" fullWidth value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <TextField label="Senha" type="password" fullWidth value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <FormControlLabel control={<Switch checked={formData.isAdmin} onChange={e => setFormData({...formData, isAdmin: e.target.checked})} />} label="Administrador" />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={handleClose}>Cancelar</Button><Button variant="contained" onClick={handleSubmit}>Salvar</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;