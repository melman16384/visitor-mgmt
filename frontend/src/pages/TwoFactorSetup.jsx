import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Copy, Check } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function TwoFactorSetup() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    client.post('/auth/2fa/setup').then(res => setSetup(res.data)).catch(() => setError('Setup konnte nicht gestartet werden'));
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/auth/2fa/verify-setup', { token: code });
      setBackupCodes(res.data.backup_codes);
      updateUser({ totp_enabled: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Ungültiger Code');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-abat-dunkelgrau flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-abat-dunkelgrau px-8 py-8 text-center">
            <ShieldCheck size={40} className="text-abat-hellblau mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-white">Zwei-Faktor-Authentifizierung einrichten</h1>
            <p className="text-abat-hellgrau text-sm mt-1">Für Admin-Konten verpflichtend, {user?.name}</p>
          </div>

          <div className="px-8 py-8 space-y-5">
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {backupCodes ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-semibold mb-1">2FA aktiviert — Backup-Codes sichern</p>
                  <p>Jeder Code funktioniert einmal, falls du keinen Zugriff mehr auf deine Authenticator-App hast. Jetzt sicher speichern — sie werden nicht erneut angezeigt.</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm grid grid-cols-2 gap-2">
                  {backupCodes.map(c => <span key={c}>{c}</span>)}
                </div>
                <button onClick={copyBackupCodes}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Kopiert' : 'Codes kopieren'}
                </button>
                <button onClick={() => navigate('/dashboard')}
                  className="w-full bg-abat-blau hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                  Ich habe die Codes gesichert — weiter
                </button>
              </>
            ) : (
              <>
                {setup && (
                  <>
                    <div className="flex justify-center">
                      <img src={setup.qr} alt="2FA QR-Code" className="w-48 h-48 border border-gray-200 rounded-xl" />
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      QR-Code mit einer Authenticator-App scannen (Google Authenticator, Microsoft Authenticator, ...).
                      Manuell: <span className="font-mono text-gray-700">{setup.secret}</span>
                    </p>
                  </>
                )}
                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-abat-dunkelgrau mb-2">Code aus der App</label>
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-abat-hellgrau rounded-xl focus:outline-none focus:border-abat-blau text-sm tracking-widest text-center font-mono"
                      placeholder="123456"
                      autoFocus
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading || !setup}
                    className="w-full bg-abat-blau hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                    {loading ? 'Wird geprüft...' : 'Bestätigen und aktivieren'}
                  </button>
                </form>
                <button onClick={logout} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Abmelden
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
