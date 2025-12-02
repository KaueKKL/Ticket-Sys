import { useEffect, useState, useContext } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Switch, useMediaQuery, useTheme,
  Divider, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert,
  Stack
} from '@mui/material';
import { 
  Add as AddIcon, Edit as EditIcon, SettingsInputComponent, People, 
  CheckCircle, ErrorOutline, Science, ReceiptLong, Undo
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
  const [integrationOptions, setIntegrationOptions] = useState({ empresas: [], objetos: [], tipos: [], servicos: [], operacoes: [] });
  
  // Config Data: Adicionado businessHours
  const [configData, setConfigData] = useState({ 
    empresaId: '', objetoId: '', campoInicioId: '', campoFimId: '', 
    produtoServicoId: '', operacaoFiscalId: '',
    businessHours: { start: '07:30', end: '17:30', lunchStart: '12:00', lunchEnd: '13:12' }
  });

  // --- Estados Laboratório ---
  const [labClient, setLabClient] = useState('');
  const [lastOsId, setLastOsId] = useState(null); 
  const [lastOsNumber, setLastOsNumber] = useState(null);
  const [testingLab, setTestingLab] = useState(false);

  const { user } = useContext(AuthContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (tabValue === 0) fetchUsers();
    if (tabValue === 1) fetchIntegrationOptions();
  }, [tabValue]);

  // --- Funções Usuários ---
  const fetchUsers = async () => { try { const res = await api.get('/users'); setUsers(res.data); } catch (e) { toast.error('Erro usuários'); } };
  const handleOpenUserModal = (u = null) => { if(u) { setEditingUserId(u._id); setUserFormData({name: u.name, email: u.email, password: '', isAdmin: u.isAdmin}); } else { setEditingUserId(null); setUserFormData({name:'', email:'', password:'', isAdmin:false}); } setOpenUserModal(true); };
  const handleUserSubmit = async () => { try { if(!userFormData.name) return; if(editingUserId) await api.put(`/users/${editingUserId}`, userFormData); else await api.post('/users', userFormData); toast.success('Salvo!'); setOpenUserModal(false); fetchUsers(); } catch(e) { toast.error('Erro salvar'); } };

  // --- Funções Integração ---
  const fetchIntegrationOptions = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.get('/integration/options');
      setIntegrationOptions(res.data);
      if (res.data.savedConfig) {
          setConfigData({ 
              ...configData, 
              ...res.data.savedConfig,
              // Garante que businessHours exista mesmo se vier vazio do banco antigo
              businessHours: res.data.savedConfig.businessHours || { start: '07:30', end: '17:30', lunchStart: '12:00', lunchEnd: '13:12' }
          });
      }
    } catch (e) { toast.error('Erro conexão ERP'); } finally { setLoadingConfig(false); }
  };

  const saveConfig = async () => { try { await api.post('/integration/config', configData); toast.success('Salvo!'); } catch (e) { toast.error('Erro salvar'); } };

  // --- Funções Laboratório ---
  const handleLabGenerate = async () => {
    if (!labClient) return toast.warning('Digite o nome exato do cliente no ERP.');
    setTestingLab(true);
    try {
      const res = await api.post('/integration/test-full-os', { clientName: labClient });
      setLastOsId(res.data.osId);
      setLastOsNumber(res.data.osNumber);
      toast.success(`Sucesso! OS Nº ${res.data.osNumber} gerada.`);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Falha ao gerar OS de teste.');
    } finally {
      setTestingLab(false);
    }
  };

  const handleLabRollback = async () => {
    if (!lastOsId) return;
    setTestingLab(true);
    try {
      await api.delete(`/integration/test-full-os/${lastOsId}`);
      toast.info(`Rollback: OS Nº ${lastOsNumber} removida.`);
      setLastOsId(null);
      setLastOsNumber(null);
    } catch (e) {
      toast.error('Erro no rollback.');
    } finally {
      setTestingLab(false);
    }
  };

  const isConfigComplete = configData.empresaId && configData.objetoId && configData.produtoServicoId && configData.operacaoFiscalId;

  return (
    <Box sx={{ width: '100%', pb: 8 }}>
      <Typography variant="h4" fontWeight="800" color="primary.main" mb={3}>Configurações</Typography>
      
      <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'transparent' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<People />} iconPosition="start" label="Usuários" />
          <Tab icon={<SettingsInputComponent />} iconPosition="start" label="Integração ERP" />
          <Tab icon={<Science />} iconPosition="start" label="Laboratório (Beta)" sx={{ color: 'secondary.main' }} />
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
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" fontWeight="bold">Parâmetros de Integração</Typography>
            <Chip 
              icon={isConfigComplete ? <CheckCircle /> : <ErrorOutline />}
              label={isConfigComplete ? "Configuração Pronta" : "Incompleto"} 
              color={isConfigComplete ? "success" : "warning"} 
              variant={isConfigComplete ? "filled" : "outlined"}
            />
          </Box>
          
          {loadingConfig ? <CircularProgress /> : (
            <Box display="flex" flexDirection="column" gap={3}>
              <Divider textAlign="left"><Chip label="Dados Gerais" /></Divider>
              <FormControl fullWidth size="small">
                <InputLabel>Empresa Matriz</InputLabel>
                <Select value={configData.empresaId} label="Empresa Matriz" onChange={e => setConfigData({...configData, empresaId: e.target.value})}>
                  {integrationOptions.empresas?.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Objeto Padrão</InputLabel>
                <Select value={configData.objetoId} label="Objeto Padrão" onChange={e => setConfigData({...configData, objetoId: e.target.value})}>
                  {integrationOptions.objetos?.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>
              
              <Divider textAlign="left"><Chip label="Financeiro (Obrigatório)" color="primary" /></Divider>
              <FormControl fullWidth required>
                <InputLabel>Serviço (Hora Técnica)</InputLabel>
                <Select value={configData.produtoServicoId} label="Serviço (Hora Técnica)" onChange={e => setConfigData({...configData, produtoServicoId: e.target.value})}>
                  {integrationOptions.servicos?.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Operação Fiscal (CFOP)</InputLabel>
                <Select value={configData.operacaoFiscalId} label="Operação Fiscal (CFOP)" onChange={e => setConfigData({...configData, operacaoFiscalId: e.target.value})}>
                  {integrationOptions.operacoes?.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>

              <Divider textAlign="left"><Chip label="Campos Extras" /></Divider>
              <Box display="flex" gap={2}>
                <FormControl fullWidth size="small"><InputLabel>Data Início</InputLabel><Select value={configData.campoInicioId} label="Data Início" onChange={e => setConfigData({...configData, campoInicioId: e.target.value})}><MenuItem value=""><em>Nenhum</em></MenuItem>{integrationOptions.tipos?.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}</Select></FormControl>
                <FormControl fullWidth size="small"><InputLabel>Data Fim</InputLabel><Select value={configData.campoFimId} label="Data Fim" onChange={e => setConfigData({...configData, campoFimId: e.target.value})}><MenuItem value=""><em>Nenhum</em></MenuItem>{integrationOptions.tipos?.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}</Select></FormControl>
              </Box>

              {/* --- NOVO BLOCO: HORÁRIO DE EXPEDIENTE --- */}
              <Divider textAlign="left"><Chip label="Horário de Expediente" color="secondary" /></Divider>
              <Box display="flex" gap={2} flexWrap="wrap">
                <TextField label="Início" type="time" value={configData.businessHours?.start} onChange={e => setConfigData({...configData, businessHours: {...configData.businessHours, start: e.target.value}})} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
                <TextField label="Início Almoço" type="time" value={configData.businessHours?.lunchStart} onChange={e => setConfigData({...configData, businessHours: {...configData.businessHours, lunchStart: e.target.value}})} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
                <TextField label="Fim Almoço" type="time" value={configData.businessHours?.lunchEnd} onChange={e => setConfigData({...configData, businessHours: {...configData.businessHours, lunchEnd: e.target.value}})} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
                <TextField label="Fim" type="time" value={configData.businessHours?.end} onChange={e => setConfigData({...configData, businessHours: {...configData.businessHours, end: e.target.value}})} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
              </Box>
              {/* ------------------------------------------ */}

              <Button variant="contained" onClick={saveConfig}>Salvar Configurações</Button>
            </Box>
          )}
        </Paper>
      )}

      {/* ABA LABORATÓRIO (EXPERIMENTAL) */}
      {tabValue === 2 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px dashed #9333ea', bgcolor: '#faf5ff', maxWidth: 800 }}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Science fontSize="large" color="secondary" />
            <Box>
              <Typography variant="h6" fontWeight="bold" color="secondary.main">Laboratório de Testes</Typography>
              <Typography variant="body2" color="text.secondary">Gere Ordens de Serviço reais no ERP para fins de validação.</Typography>
            </Box>
          </Box>

          <Alert severity="warning" sx={{ mb: 3 }}>
            Use esta ferramenta com cuidado. Ela insere dados reais na tabela de Movimentações do ERP.
            Certifique-se de usar o botão <b>Rollback</b> após o teste para limpar a sujeira.
          </Alert>

          <Stack spacing={3}>
            <TextField 
              label="Nome Exato do Cliente (ERP)" 
              placeholder="Ex: KAUE KEISER LINDNER"
              fullWidth 
              value={labClient} 
              onChange={(e) => setLabClient(e.target.value)}
              helperText="O nome deve ser idêntico ao cadastro no Digisat."
            />

            <Box display="flex" gap={2}>
              <Button 
                variant="contained" 
                color="secondary" 
                size="large"
                startIcon={testingLab ? <CircularProgress size={20} color="inherit"/> : <ReceiptLong />}
                onClick={handleLabGenerate}
                disabled={testingLab || !isConfigComplete}
              >
                Gerar OS de Teste
              </Button>

              <Button 
                variant="outlined" 
                color="error" 
                size="large"
                startIcon={<Undo />}
                onClick={handleLabRollback}
                disabled={!lastOsId || testingLab}
              >
                Rollback (Deletar OS {lastOsNumber})
              </Button>
            </Box>

            {lastOsId && (
              <Alert severity="success" icon={<CheckCircle fontSize="inherit" />}>
                OS gerada com sucesso! ID Interno: {lastOsId} <br/>
                Verifique no ERP se os dados conferem (Itens, Financeiro, Cliente).
              </Alert>
            )}
          </Stack>
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