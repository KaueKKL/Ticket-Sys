import { createContext, useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const recoveredUser = localStorage.getItem('user');
    if (recoveredUser) {
      setUser(JSON.parse(recoveredUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/users/login', { email, password });
      const loggedUser = response.data;

      localStorage.setItem('user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      toast.success(`Bem-vindo, ${loggedUser.name}!`);
      return true;
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Erro ao fazer login";
      toast.error(msg);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
    toast.info("Você saiu do sistema.");
  };

  return (
    <AuthContext.Provider value={{ authenticated: !!user, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};