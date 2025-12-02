import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext'; // <--- Importante
import AppRoutes from './AppRoutes';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* O AuthProvider deve envolver toda a aplicação que precisa de autenticação */}
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <ToastContainer autoClose={3000} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;