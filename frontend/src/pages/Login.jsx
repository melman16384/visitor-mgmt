import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemoCredentials, setShowDemoCredentials] = useState(true);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/settings/privacy-policy').then(r => {
      setShowDemoCredentials(r.data.show_demo_credentials !== false);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-abat-dunkelgrau flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative w-full max-w-xl">
        {/* Card */}
        <div className="kiosk-fade-up bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-abat-dunkelgrau px-8 py-8 text-center">
            <img src="/logo-light.png" alt="abat AG" className="kiosk-pop-in h-14 mx-auto mb-4" />
            <h1 className="kiosk-fade-up kiosk-delay-1 text-2xl font-bold text-white">{t('login.title')}</h1>
            <p className="kiosk-fade-up kiosk-delay-2 text-abat-hellgrau text-sm mt-1">{t('login.subtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {error && (
              <div className="kiosk-fade-up flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="kiosk-fade-up kiosk-delay-2">
              <label className="block text-sm font-semibold text-abat-dunkelgrau mb-2">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-abat-hellgrau rounded-xl focus:outline-none focus:border-abat-blau text-sm transition-all"
                placeholder="name@firma.de"
                required
                autoComplete="email"
              />
            </div>

            <div className="kiosk-fade-up kiosk-delay-3">
              <label className="block text-sm font-semibold text-abat-dunkelgrau mb-2">{t('login.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-abat-hellgrau rounded-xl focus:outline-none focus:border-abat-blau text-sm pr-12 transition-all"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="kiosk-fade-up kiosk-delay-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-abat-blau hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md hover:shadow-lg text-sm active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('login.loggingIn')}
                  </span>
                ) : t('login.submit')}
              </button>
            </div>

            {/* Demo credentials */}
            {showDemoCredentials && (
              <div className="kiosk-fade-up kiosk-delay-5 bg-gray-50 rounded-xl p-4 text-xs text-gray-500 border border-gray-100">
                <p className="font-semibold text-gray-600 mb-2">Demo-Zugangsdaten:</p>
                <p>Admin: <span className="font-mono text-gray-700">admin@firma.de</span> / <span className="font-mono text-gray-700">Admin123!</span></p>
                <p>Empfang: <span className="font-mono text-gray-700">empfang@firma.de</span> / <span className="font-mono text-gray-700">Empfang123!</span></p>
              </div>
            )}
          </form>
        </div>

        <p className="kiosk-fade-up kiosk-delay-5 text-center text-abat-hellgrau text-xs mt-6">
          © 2025 abat AG Besucherverwaltung
        </p>
      </div>
    </div>
  );
}
