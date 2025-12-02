import { useEffect, useState, useContext } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Switch, useMediaQuery, useTheme,
  Divider, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert
} from '@mui/material';
import { 
  Add as AddIcon, Edit as EditIcon, SettingsInputComponent, People, 
  CheckCircle, ErrorOutline
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const Settings = () => {
  const [tabValue, setTabValue] = useState(0);
  
  // --- Estados Usuários ---
  const [users, setUsers] = useState([]);
  const [openUserModal, setOpenUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userFormData, setUserFormData] = useState({ name: '', email: '', password: '', isAdmin: false });
  
  // --- Estados Integração ---
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [integrationOptions, setIntegrationOptions] = useState({ 
    empresas: [], objetos: [], tipos: [], servicos: [], operacoes: [] 
  });
  const [configData, setConfigData] = useState({ 
    empresaId: '', objetoId: '', campoInicioId: '', campoFimId: '', 
    produtoServicoId: '', operacaoFiscalId: '' 
  });

  const { user } = useContext(AuthContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (tabValue === 0) fetchUsers();
    if (tabValue === 1) fetchIntegrationOptions();
  }, [tabValue]);

  // --- Lógica Usuários ---
  const fetchUsers = async () => { try { const res = await api.get('/users'); setUsers(res.data); } catch (e) { toast.error('Erro ao listar usuários'); } };
  const handleOpenUserModal = (u = null) => { 
    if(u) { setEditingUserId(u._id); setUserFormData({name: u.name, email: u.email, password: '', isAdmin: u.isAdmin}); } 
    else { setEditingUserId(null); setUserFormData({name:'', email:'', password:'', isAdmin:false}); } 
    setOpenUserModal(true); 
  };
  const handleUserSubmit = async () => { 
    try { 
      if(!userFormData.name || !userFormData.email) return toast.warning('Dados vazios'); 
      if(editingUserId) await api.put(`/users/${editingUserId}`, userFormData); 
      else await api.post('/users', userFormData); 
      toast.success('Salvo!'); setOpenUserModal(false); fetchUsers(); 
    } catch(e) { toast.error(e.response?.data?.message); } 
  };

  // --- LÓGICA INTEGRAÇÃO ---
  const fetchIntegrationOptions = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.get('/integration/options');
      setIntegrationOptions({ 
        empresas: res.data.empresas, 
        objetos: res.data.objetos, 
        tipos: res.data.tipos,
        servicos: res.data.servicos || [],
        operacoes: res.data.operacoes || []
      });
      if (res.data.savedConfig) {
        setConfigData({
          empresaId: res.data.savedConfig.empresaId || '',
          objetoId: res.data.savedConfig.objetoId || '',
          campoInicioId: res.data.savedConfig.campoInicioId || '',
          campoFimId: res.data.savedConfig.campoFimId || '',
          produtoServicoId: res.data.savedConfig.produtoServicoId || '',
          operacaoFiscalId: res.data.savedConfig.operacaoFiscalId || ''
        });
      }
    } catch (e) { 
      console.error(e);
      toast.error('Erro ao conectar com ERP.'); 
    } finally { 
      setLoadingConfig(false); 
    }
  };

  const saveConfig = async () => {
    try {
      await api.post('/integration/config', configData);
      toast.success('Configurações salvas com sucesso!');
    } catch (e) { toast.error('Erro ao salvar configurações.'); }
  };

  const isConfigComplete = configData.empresaId && configData.objetoId && configData.produtoServicoId && configData.operacaoFiscalId;

  return (
    <Box sx={{ width: '100%', pb: 8 }}>
      <Typography variant="h4" fontWeight="800" color="primary.main" mb={3}>Configurações</Typography>
      
      <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'transparent' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant={isMobile ? "fullWidth" : "standard"}>
          <Tab icon={<People />} iconPosition="start" label="Usuários" />
          <Tab icon={<SettingsInputComponent />} iconPosition="start" label="Integração ERP" />
        </Tabs>
      </Paper>

      {/* ABA USUÁRIOS */}
      {tabValue === 0 && (
        <Box>
           <Box display="flex" justifyContent="flex-end" mb={2}>
             <Button variant="contained" onClick={() => handleOpenUserModal()} startIcon={<AddIcon />}>Novo Usuário</Button>
           </Box>
           <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
             <Table>
               <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Email</TableCell><TableCell align="right">Ação</TableCell></TableRow></TableHead>
               <TableBody>
                 {users.map(u => (
                   <TableRow key={u._id}>
                     <TableCell>{u.name} {u.isAdmin && <Chip label="Admin" size="small" color="primary" sx={{ ml: 1, height: 20 }} />}</TableCell>
                     <TableCell>{u.email}</TableCell>
                     <TableCell align="right"><IconButton onClick={() => handleOpenUserModal(u)}><EditIcon/></IconButton></TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </TableContainer>
        </Box>
      )}

      {/* ABA INTEGRAÇÃO */}
      {tabValue === 1 && (
        <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', maxWidth: 800 }}>
          
          <Box display="flex" flexDirection="column" gap={1} mb={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight="bold">Parâmetros de Integração</Typography>
              <Chip 
                icon={isConfigComplete ? <CheckCircle /> : <ErrorOutline />}
                label={isConfigComplete ? "Configuração Pronta" : "Incompleto"} 
                color={isConfigComplete ? "success" : "warning"} 
                variant={isConfigComplete ? "filled" : "outlined"}
              />
            </Box>
            {!isConfigComplete && (
              <Alert severity="warning">Para gerar faturamento, preencha todos os campos obrigatórios abaixo.</Alert>
            )}
          </Box>
          
          {loadingConfig ? <Box display="flex" justifyContent="center"><CircularProgress /></Box> : (
            <Box display="flex" flexDirection="column" gap={3}>
              
              <Divider textAlign="left"><Chip label="Dados Gerais" /></Divider>
              <FormControl fullWidth size="small">
                <InputLabel>Empresa Matriz (Emitente)</InputLabel>
                <Select value={configData.empresaId} label="Empresa Matriz (Emitente)" onChange={e => setConfigData({...configData, empresaId: e.target.value})}>
                  {integrationOptions.empresas.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>
              
              <FormControl fullWidth size="small">
                <InputLabel>Objeto Padrão (Equipamento)</InputLabel>
                <Select value={configData.objetoId} label="Objeto Padrão (Equipamento)" onChange={e => setConfigData({...configData, objetoId: e.target.value})}>
                  {integrationOptions.objetos.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>
              
              <Divider textAlign="left"><Chip label="Financeiro (Obrigatório)" color="primary" /></Divider>
              
              <FormControl fullWidth required>
                <InputLabel>Serviço (Hora Técnica)</InputLabel>
                <Select value={configData.produtoServicoId} label="Serviço (Hora Técnica)" onChange={e => setConfigData({...configData, produtoServicoId: e.target.value})}>
                  <MenuItem value=""><em>Selecione...</em></MenuItem>
                  {integrationOptions.servicos.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Operação Fiscal (CFOP)</InputLabel>
                <Select value={configData.operacaoFiscalId} label="Operação Fiscal (CFOP)" onChange={e => setConfigData({...configData, operacaoFiscalId: e.target.value})}>
                  <MenuItem value=""><em>Selecione...</em></MenuItem>
                  {integrationOptions.operacoes.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>

              <Divider textAlign="left"><Chip label="Campos Extras (Opcional)" /></Divider>
              <Box display="flex" gap={2} flexDirection={isMobile ? 'column' : 'row'}>
                <FormControl fullWidth size="small"><InputLabel>Data Início</InputLabel><Select value={configData.campoInicioId} label="Data Início" onChange={e => setConfigData({...configData, campoInicioId: e.target.value})}><MenuItem value=""><em>Nenhum</em></MenuItem>{integrationOptions.tipos.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}</Select></FormControl>
                <FormControl fullWidth size="small"><InputLabel>Data Fim</InputLabel><Select value={configData.campoFimId} label="Data Fim" onChange={e => setConfigData({...configData, campoFimId: e.target.value})}><MenuItem value=""><em>Nenhum</em></MenuItem>{integrationOptions.tipos.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}</Select></FormControl>
              </Box>

              <Button variant="contained" size="large" onClick={saveConfig} sx={{ mt: 2 }}>Salvar Configurações</Button>
            </Box>
          )}
        </Paper>
      )}
      
      {/* Modal Usuário */}
      <Dialog open={openUserModal} onClose={() => setOpenUserModal(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingUserId ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField label="Nome" fullWidth value={userFormData.name} onChange={e=>setUserFormData({...userFormData, name:e.target.value})} />
            <TextField label="Email" fullWidth value={userFormData.email} onChange={e=>setUserFormData({...userFormData, email:e.target.value})} />
            <TextField label={editingUserId ? "Nova Senha (Opcional)" : "Senha"} type="password" fullWidth value={userFormData.password} onChange={e=>setUserFormData({...userFormData, password:e.target.value})} />
            <FormControlLabel control={<Switch checked={userFormData.isAdmin} onChange={e=>setUserFormData({...userFormData, isAdmin:e.target.checked})} />} label="Administrador" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenUserModal(false)}>Cancelar</Button>
          <Button onClick={handleUserSubmit} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;