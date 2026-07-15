import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // Refresh cached user (role, active-status, ...) from the server on load —
  // a stale localStorage snapshot would otherwise keep an outdated role forever.
  useEffect(() => {
    if (!token) return;
    client.get('/auth/me').then(res => {
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    }).catch(() => {});
  }, []);

  const completeSession = useCallback((newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  // Returns either { requires_2fa: true, pending_token } for a second step,
  // or { token, user, requires_2fa_setup } once the session is fully established.
  const login = useCallback(async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    if (res.data.requires_2fa) return res.data;
    completeSession(res.data.token, res.data.user);
    return res.data;
  }, [completeSession]);

  const verify2fa = useCallback(async (pendingToken, { token, backup_code }) => {
    const res = await client.post('/auth/2fa/login-verify', { pending_token: pendingToken, token, backup_code });
    completeSession(res.data.token, res.data.user);
    return res.data;
  }, [completeSession]);

  const updateUser = useCallback((patch) => {
    setUser(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, login, verify2fa, updateUser, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
