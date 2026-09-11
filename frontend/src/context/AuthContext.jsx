import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(API.getUser());
  const [token, setToken] = useState(API.getToken());

  useEffect(() => {
    const handleAuthChange = () => {
      setUser(API.getUser());
      setToken(API.getToken());
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const login = async (email, password) => {
    const data = await API.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setToken(data.token);
    window.dispatchEvent(new Event('auth-change'));
    return data;
  };

  const register = async (userData) => {
    const data = await API.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setToken(data.token);
      window.dispatchEvent(new Event('auth-change'));
    }
    return data;
  };

  const googleLogin = async (credential) => {
    const data = await API.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setToken(data.token);
    window.dispatchEvent(new Event('auth-change'));
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    window.dispatchEvent(new Event('auth-change'));
    API.showToast('Logged out successfully', 'info');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn: !!token, isAdmin: user?.role === 'admin', login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
