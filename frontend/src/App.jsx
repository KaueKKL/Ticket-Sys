import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import { CssBaseline, ThemeProvider } from '@mui/material'; // <--- Importe ThemeProvider
import AppRoutes from './AppRoutes';
import theme from './theme'; // <--- Importe o tema criado

function App() {
  return (
    <ThemeProvider theme={theme}> {/* <--- Envolva o App */}
      <CssBaseline />
      <ToastContainer autoClose={3000} position="top-right" />
      <AppRoutes />
    </ThemeProvider>
  );
}

export default App;