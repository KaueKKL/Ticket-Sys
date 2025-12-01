import { useEffect, useState } from 'react';
import { 
  Grid, Typography, Box, Card, CardContent, 
  CircularProgress, Avatar, LinearProgress, Divider, Paper, Chip, IconButton, Tooltip
} from '@mui/material';
import { 
  CalendarToday, AccessTime, TrendingUp, PersonOutline, Refresh, Business, ConfirmationNumberOutlined
} from '@mui/icons-material';
import api from '../../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tickets/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error("Erro dados", error);
      setStats({ dailyTickets: 0, weeklyTickets: 0, monthlyTickets: 0, ticketsByTechnician: [], topClients: [] });
    } finally { setLoading(false); }
  };

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m > 0 ? `${m}m` : ''}`;
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', height: '80vh', alignItems: 'center' }}><CircularProgress /></Box>;

  const clientsByCount = stats?.topClients ? [...stats.topClients].sort((a, b) => b.ticketCount - a.ticketCount).slice(0,5) : [];
  const clientsByTime = stats?.topClients ? [...stats.topClients].sort((a, b) => b.totalTime - a.totalTime).slice(0,5) : [];

  return (
    <Box sx={{ width: '100%', p: { xs: 0, md: 1 } }}>
      
      {/* Header Responsivo */}
      <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" color="#1e293b">Dashboard</Typography>
          <Typography variant="body1" color="text.secondary">Visão Geral</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          <Chip icon={<AccessTime />} label="Hoje" sx={{ bgcolor: 'white', fontWeight: 500 }} />
          <IconButton onClick={fetchDashboardData} sx={{ bgcolor: 'white' }}><Refresh color="primary" /></IconButton>
        </Box>
      </Box>

      {/* KPIs - Grid v2 Syntax */}
      <Grid container spacing={3} sx={{ mb: 4 }}> 
        <MetricCard title="Hoje" value={stats?.dailyTickets || 0} subtitle="Novos " gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" />
        <MetricCard title="Semana" value={stats?.weeklyTickets || 0} subtitle="Seg - Dom" gradient="linear-gradient(135deg, #00b09b 0%, #96c93d 100%)" />
        <MetricCard title="Mês" value={stats?.monthlyTickets || 0} subtitle="Total " gradient="linear-gradient(135deg, #108dc7 0%, #ef8e38 100%)" />
      </Grid>

      {/* Conteúdo Principal */}
      <Grid container spacing={3}>
        
        {/* Técnicos */}
        <Grid size={{ xs: 12, lg: 8 }}> 
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid rgba(0,0,0,0.06)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Avatar sx={{ bgcolor: '#e0f2f1', color: '#00695c' }}><PersonOutline /></Avatar>
              <Typography variant="h6" fontWeight="bold">Tickets Por Técnico</Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={2}>
              {stats?.ticketsByTechnician?.length > 0 ? (
                stats.ticketsByTechnician.map((tech, index) => (
                  <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
                    <TechnicianCard name={tech.technician} count={tech.count} />
                  </Grid>
                ))
              ) : (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ py: 6, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2 }}><Typography color="text.secondary">Sem dados.</Typography></Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Clientes */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid rgba(0,0,0,0.06)' }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', gap: 1 }}><TrendingUp color="primary"/> Top Demandas</Typography>
              {clientsByCount.length > 0 ? clientsByCount.map((c, i) => <ClientListItem key={i} name={c.client} value={c.ticketCount} percent={(c.ticketCount / (stats.monthlyTickets||1))*100} />) : <Typography variant="caption">Sem dados</Typography>}
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid rgba(0,0,0,0.06)' }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', gap: 1 }}><AccessTime color="secondary"/> Top Tempo</Typography>
              {clientsByTime.length > 0 ? clientsByTime.map((c, i) => <ClientListItem key={i} name={c.client} value={formatTime(c.totalTime)} percent={60} color="secondary" />) : <Typography variant="caption">Sem dados</Typography>}
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// Sub-Componentes
const MetricCard = ({ title, value, subtitle, gradient }) => (
  <Grid size={{ xs: 12, sm: 4 }}> 
    <Card elevation={0} sx={{ background: gradient, color: '#fff', borderRadius: 4, height: 140, position: 'relative', overflow: 'hidden' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="overline" fontWeight={700} sx={{ opacity: 0.9 }}>{title.toUpperCase()}</Typography>
        <Typography variant="h3" fontWeight="bold">{value}</Typography>
        <Chip label={subtitle} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', height: 24 }} />
        <CalendarToday sx={{ position: 'absolute', right: -15, top: -15, opacity: 0.15, fontSize: 100 }} />
      </CardContent>
    </Card>
  </Grid>
);

const TechnicianCard = ({ name, count }) => (
  <Card elevation={0} sx={{ border: '1px solid #f1f5f9', borderRadius: 3, bgcolor: '#f8fafc', '&:hover': { bgcolor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
      <Avatar sx={{ bgcolor: '#3b82f6', fontWeight: 'bold', mr: 2 }}>{name.charAt(0)}</Avatar>
      <Box><Typography variant="subtitle2" fontWeight="bold" noWrap>{name.split(' ')[0]}</Typography><Typography variant="h6" fontWeight="800">{count}</Typography></Box>
    </CardContent>
  </Card>
);

const ClientListItem = ({ name, value, percent, color = 'primary' }) => (
  <Box sx={{ mb: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
      <Typography variant="body2" fontWeight="600" noWrap sx={{ maxWidth: '70%' }}>{name}</Typography>
      <Typography variant="caption" fontWeight="bold" sx={{ bgcolor: '#f1f5f9', px: 1, borderRadius: 1 }}>{value}</Typography>
    </Box>
    <LinearProgress variant="determinate" value={percent > 100 ? 100 : percent} color={color} sx={{ height: 6, borderRadius: 3, bgcolor: '#f1f5f9' }} />
  </Box>
);

export default Dashboard;