import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('shareb_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [partner, setPartner] = useState(null);

  useEffect(() => {
    if (user) {
      api.get('/auth/partner').then(res => setPartner(res.data.partner)).catch(() => {});
    }
  }, [user]);

  function login(token, userData) {
    localStorage.setItem('shareb_token', token);
    localStorage.setItem('shareb_user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('shareb_token');
    localStorage.removeItem('shareb_user');
    setUser(null);
    setPartner(null);
  }

  return (
    <AuthContext.Provider value={{ user, partner, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
