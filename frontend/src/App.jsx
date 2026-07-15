import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { KioskLangProvider } from './context/KioskLangContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import TwoFactorSetup from './pages/TwoFactorSetup';
import Dashboard from './pages/Dashboard';
import Visitors from './pages/Visitors';
import KioskStart from './pages/KioskStart';
import KioskCheckin from './pages/KioskCheckin';
import KioskCheckout from './pages/KioskCheckout';
import KioskManual from './pages/KioskManual';
import Hosts from './pages/Hosts';
import PreRegistration from './pages/PreRegistration';

import Evacuation from './pages/Evacuation';
import EvacuationPrint from './pages/EvacuationPrint';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import HostLogin from './pages/HostLogin';
import HostPortal from './pages/HostPortal';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'admin' && !user?.totp_enabled && location.pathname !== '/2fa-setup') {
    return <Navigate to="/2fa-setup" replace />;
  }
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/host/login" element={<HostLogin />} />
      <Route path="/host" element={<HostPortal />} />
      <Route path="/kiosk" element={<KioskLangProvider><KioskStart /></KioskLangProvider>} />
      <Route path="/kiosk/checkin" element={<KioskLangProvider><KioskCheckin /></KioskLangProvider>} />
      <Route path="/kiosk/checkout" element={<KioskLangProvider><KioskCheckout /></KioskLangProvider>} />
      <Route path="/kiosk/manual" element={<KioskLangProvider><KioskManual /></KioskLangProvider>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/2fa-setup" element={<ProtectedRoute><TwoFactorSetup /></ProtectedRoute>} />
      <Route path="/evacuation/print" element={<ProtectedRoute><EvacuationPrint /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/visitors" element={<Visitors />} />
        <Route path="/hosts" element={<Hosts />} />
        <Route path="/preregistrations" element={<PreRegistration />} />

        <Route path="/evacuation" element={<Evacuation />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-log" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
