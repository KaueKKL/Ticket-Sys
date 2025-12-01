import { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import LoginPage from './pages/Login';
import MainLayout from './layouts/MainLayout';

// Importação das Páginas
import Dashboard from './pages/Dashboard';
import TicketList from './pages/Tickets';
import Settings from './pages/Settings';
import Billing from './pages/Billing';

// Componente de Carregamento Simples
const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 50 }}>
    Carregando sistema...
  </div>
);

// Guardião de Rotas Privadas
const PrivateRoute = () => {
  const { authenticated, loading } = useContext(AuthContext);

  if (loading) {
    return <Loading />;
  }

  if (!authenticated) {
    return <Navigate to="/login" />;
  }

  return <MainLayout />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Rotas Protegidas (Aninhadas no MainLayout) */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Rota de Fallback */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;