import { useState, useContext } from 'react';
import { 
  Box, Card, CardContent, TextField, Button, Typography, 
  Container, InputAdornment, IconButton, CircularProgress, useTheme
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Https } from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const theme = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);
    if (success) {
      navigate('/');
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        width: '100vw',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        p: 2
      }}
    >
      <Container maxWidth="xs">
        <Card 
          elevation={10}
          sx={{ 
            borderRadius: 4, 
            bgcolor: 'rgba(255, 255, 255, 0.98)',
            p: { xs: 2, md: 4 }
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Box 
                sx={{ 
                  width: 64, height: 64, 
                  bgcolor: 'primary.main', 
                  borderRadius: 3, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', mb: 2,
                  boxShadow: `0 8px 24px ${theme.palette.primary.light}`
                }}
              >
                <Https sx={{ color: 'white', fontSize: 32 }} />
              </Box>
              <Typography variant="h5" fontWeight="800" color="primary.main">
                Ticket System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Acesso Restrito
              </Typography>
            </Box>

            <form onSubmit={handleSubmit}>
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment>,
                }}
              />
              
              <TextField
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Https color="action" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button 
                type="submit" 
                variant="contained" 
                fullWidth 
                size="large"
                disabled={isSubmitting}
                sx={{ mt: 3, mb: 2, height: 48, borderRadius: 2, fontSize: '1rem' }}
              >
                {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;