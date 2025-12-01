import { useState, useContext } from 'react';
import { 
  Box, CssBaseline, AppBar, Toolbar, IconButton, Typography, 
  Drawer, Divider, List, ListItem, ListItemButton, ListItemIcon, 
  ListItemText, Avatar, useMediaQuery, useTheme, Badge
} from '@mui/material';
import { 
  Menu as MenuIcon, Dashboard as DashboardIcon, ConfirmationNumber as TicketIcon, 
  Settings as SettingsIcon, Logout as LogoutIcon, Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const drawerWidth = 280;

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Meus Tickets', icon: <TicketIcon />, path: '/tickets' },
    ...(user?.isAdmin ? [{ text: 'Configurações', icon: <SettingsIcon />, path: '/settings' }] : [])
  ];

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff' }}>
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: '2rem', fontWeight: 'bold', boxShadow: '0 8px 16px rgba(26, 35, 126, 0.2)' }}>
          {user?.name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ color: 'text.primary', lineHeight: 1.2 }}>
            {user?.name?.split(' ')[0]}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
            {user?.isAdmin ? 'Administrador' : 'Técnico'}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ mx: 3, opacity: 0.6 }} />
      <List sx={{ flexGrow: 1, px: 2, mt: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                selected={isActive}
                sx={{
                  borderRadius: 2, py: 1.5,
                  '&.Mui-selected': { 
                    bgcolor: 'rgba(26, 35, 126, 0.08)', color: 'primary.main',
                    borderLeft: `4px solid ${theme.palette.primary.main}`,
                    '&:hover': { bgcolor: 'rgba(26, 35, 126, 0.12)' },
                    '& .MuiListItemIcon-root': { color: 'primary.main' }
                  },
                  '&:hover': { bgcolor: '#f8fafc', transform: 'translateX(4px)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isActive ? 'primary.main' : 'text.secondary' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ p: 2 }}>
        <ListItemButton onClick={logout} sx={{ borderRadius: 2, color: '#ef4444', bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' }, justifyContent: 'center' }}>
          <LogoutIcon sx={{ mr: 1, fontSize: 20 }} /><Typography fontWeight="600">Sair</Typography>
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <AppBar position="fixed" elevation={0} sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0', color: 'text.primary' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: 'none' } }}><MenuIcon /></IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton size="small"><Badge badgeContent={0} color="error"><NotificationsIcon color="action" /></Badge></IconButton>
            <Divider orientation="vertical" flexItem height={20} />
            <Typography variant="subtitle2" fontWeight="bold">{user?.name}</Typography>
          </Box>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}>{drawerContent}</Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid #e2e8f0' } }} open>{drawerContent}</Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${drawerWidth}px)` }, p: 3, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;