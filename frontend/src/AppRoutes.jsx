import { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';

// Importação das Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import Settings from './pages/Settings';
import Billing from './pages/Billing'; // <--- Importação Nova

const AppRoutes = () => {
  const { authenticated, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  if (!authenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/billing" element={<Billing />} /> {/* <--- Rota Nova */}
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </MainLayout>
  );
};

export default AppRoutes;