import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, QrCode, User, Building2, RefreshCw } from 'lucide-react';
import client from '../api/client';

const RESET_DELAY = 5000;

export default function CheckIn() {
  const [mode, setMode] = useState('idle'); // idle | success | error
  const [qrInput, setQrInput] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', company: '', host_id: '', purpose: 'Besprechung' });
  const [hosts, setHosts] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const qrRef = useRef(null);
  const resetTimer = useRef(null);

  useEffect(() => {
    client.get('/hosts').then(r => setHosts(r.data)).catch(() => {});
  }, []);

  const scheduleReset = () => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setMode('idle');
      setQrInput('');
      setForm({ first_name: '', last_name: '', company: '', host_id: '', purpose: 'Besprechung' });
      setResult(null);
    }, RESET_DELAY);
  };

  const handleQrCheckin = async (e) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    setLoading(true);
    try {
      const res = await client.post(`/preregistrations/qr/${qrInput.trim()}/checkin`);
      setResult(res.data);
      setMode('success');
      scheduleReset();
    } catch (err) {
      const msg = err.response?.data?.error || 'QR-Code nicht gefunden';
      setResult({ error: msg });
      setMode('error');
      scheduleReset();
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckin = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name) return;
    setLoading(true);
    try {
      const res = await client.post('/visitors', form);
      setResult(res.data);
      setMode('success');
      scheduleReset();
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Fehler beim Einchecken' });
      setMode('error');
      scheduleReset();
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    clearTimeout(resetTimer.current);
    setMode('idle');
    setQrInput('');
    setForm({ first_name: '', last_name: '', company: '', host_id: '', purpose: 'Besprechung' });
    setResult(null);
  };

  if (mode === 'success') {
    const visitor = result?.visitor;
    const visit = result?.visit;
    const host = result?.host;
    return (
      <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center p-8 text-center">
        <div className="animate-bounce mb-6">
          <CheckCircle size={80} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">
          Willkommen, {visitor?.first_name} {visitor?.last_name}!
        </h1>
        <p className="text-green-100 text-xl mb-2">
          Ihr Gastgeber <strong>{host?.name || result?.host_name || '–'}</strong> wurde benachrichtigt.
        </p>
        <div className="mt-8 flex items-center gap-3 text-green-200 text-sm">
          <RefreshCw size={16} className="animate-spin" />
          <span>Wird in {Math.round(RESET_DELAY / 1000)} Sekunden zurückgesetzt...</span>
        </div>
        <button onClick={reset} className="mt-4 text-white underline text-sm opacity-70 hover:opacity-100">
          Jetzt zurücksetzen
        </button>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-orange-500 flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle size={80} className="text-white mb-6" />
        <h1 className="text-3xl font-bold text-white mb-3">Fehler</h1>
        <p className="text-orange-100 text-xl">{result?.error}</p>
        <button onClick={reset} className="mt-8 bg-white text-orange-600 font-bold px-8 py-3 rounded-2xl text-lg hover:bg-orange-50 transition-colors">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-600 flex flex-col">
      {/* Header */}
      <div className="text-center py-10 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
          <Building2 size={32} className="text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Willkommen!</h1>
        <p className="text-primary-200 text-lg mt-2">Bitte melden Sie sich an</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-6 px-4 pb-10 max-w-5xl mx-auto w-full">
        {/* QR Code Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full lg:w-1/2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-2.5 rounded-xl">
              <QrCode size={22} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">QR-Code einscannen</h2>
              <p className="text-sm text-gray-500">Vorregistriert? QR-Code hier eingeben</p>
            </div>
          </div>
          <form onSubmit={handleQrCheckin} className="space-y-4">
            <input
              ref={qrRef}
              type="text"
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              placeholder="QR-Code scannen oder eingeben..."
              className="w-full border-2 border-gray-300 rounded-xl px-5 py-4 text-lg font-mono focus:outline-none focus:border-primary-500 focus:ring-0 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !qrInput.trim()}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              {loading ? 'Wird verarbeitet...' : 'QR-Code prüfen'}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex lg:flex-col items-center justify-center gap-3 lg:py-12">
          <div className="w-24 lg:w-px h-px lg:h-24 bg-white/30" />
          <span className="text-white/60 font-semibold text-sm">ODER</span>
          <div className="w-24 lg:w-px h-px lg:h-24 bg-white/30" />
        </div>

        {/* Manual Check-in */}
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full lg:w-1/2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 p-2.5 rounded-xl">
              <User size={22} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Manuell einchecken</h2>
              <p className="text-sm text-gray-500">Ohne Vorregistrierung</p>
            </div>
          </div>
          <form onSubmit={handleManualCheckin} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vorname *</label>
                <input className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required placeholder="Max" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nachname *</label>
                <input className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required placeholder="Mustermann" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Unternehmen</label>
              <input className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Beispiel GmbH" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Gastgeber *</label>
              <select className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.host_id} onChange={e => setForm(f => ({ ...f, host_id: e.target.value }))} required>
                <option value="">– Gastgeber wählen –</option>
                {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zweck</label>
              <select className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}>
                {['Besprechung', 'Lieferung', 'Interview', 'Wartung', 'Sonstiges'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              {loading ? 'Wird eingecheckt...' : 'Einchecken'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
