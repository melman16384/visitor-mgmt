import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, User, Building2, ChevronRight } from 'lucide-react';
import QRScanner from '../components/QRScanner';
import SignaturePad from '../components/SignaturePad';
import KioskHeader from '../components/KioskHeader';
import api from '../api/client';
import { useKioskLang } from '../context/KioskLangContext';
import useKioskIdle from '../hooks/useKioskIdle';

const STATE_RANK = { scan: 0, confirm: 1, privacy: 2, success: 3, error: 3 };

function AbatIdInput({ onSubmit, loading, error }) {
  const [digits, setDigits] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
    setDigits(val);
    if (val.length === 8) onSubmit('ABAT-' + val);
  };
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <p className="text-abat-grau text-sm text-center">Geben Sie Ihre abat-ID aus der Einladungs-E-Mail ein</p>
      <div className="flex items-center border-2 border-abat-hellgrau focus-within:border-abat-blau rounded-2xl overflow-hidden transition-colors w-full">
        <span className="bg-gray-100 px-4 py-4 text-xl font-mono font-bold text-abat-dunkelgrau select-none border-r border-abat-hellgrau whitespace-nowrap">ABAT-</span>
        <input ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]*" value={digits}
          onChange={handleChange} placeholder="00000000" maxLength={8}
          className="flex-1 px-4 py-4 text-xl font-mono tracking-widest text-abat-dunkelgrau placeholder-abat-hellgrau focus:outline-none bg-white" />
      </div>
      <p className="text-xs text-abat-grau">{digits.length}/8 Ziffern{digits.length === 8 && !loading && <span className="text-green-600 ml-2">✓ Wird gesucht…</span>}</p>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
    </div>
  );
}

export default function KioskCheckin() {
  const navigate = useNavigate();
  const { t } = useKioskLang();

  const [state, setState] = useState('scan');

  useKioskIdle(60_000, () => navigate('/kiosk'));
  const [animKey, setAnimKey] = useState(0);
  const dirRef = useRef('forward');

  const [prereg, setPrereg] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', company: '' });
  const [signature, setSignature] = useState(null);
  const [privacyPolicy, setPrivacyPolicy] = useState({ text: '', enabled: false });
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(6);
  const [abatLoading, setAbatLoading] = useState(false);
  const [abatError, setAbatError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/settings/privacy-policy').then(r => setPrivacyPolicy(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (state === 'success' || state === 'error') {
      const timer = setInterval(() => {
        setCountdown(c => { if (c <= 1) { clearInterval(timer); navigate('/kiosk'); } return c - 1; });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, navigate]);

  const go = (newState) => {
    dirRef.current = (STATE_RANK[newState] ?? 0) >= (STATE_RANK[state] ?? 0) ? 'forward' : 'back';
    setAnimKey(k => k + 1);
    setState(newState);
  };

  const animClass = (state === 'success' || state === 'error')
    ? 'kiosk-fade-up'
    : dirRef.current === 'forward' ? 'kiosk-slide-right' : 'kiosk-slide-left';

  const loadPrereg = async (code) => {
    const res = await api.get('/preregistrations/qr/' + code);
    setPrereg(res.data);
    setFormData({
      first_name: res.data.visitor_first_name || '',
      last_name: res.data.visitor_last_name || '',
      company: res.data.visitor_company || '',
    });
    setQrCode(code);
    go('confirm');
  };

  const handleQRScan = async (code) => {
    try { await loadPrereg(code); }
    catch (e) {
      setResult({ error: e.response?.status === 404 ? 'QR-Code nicht gefunden oder bereits verwendet' : (e.response?.data?.error || 'Fehler') });
      setCountdown(6);
      go('error');
    }
  };

  const handleAbatLookup = async (abatId) => {
    setAbatLoading(true); setAbatError('');
    try {
      const res = await api.get('/preregistrations/by-abat-id/' + encodeURIComponent(abatId));
      await loadPrereg(res.data.qr_code);
    } catch (e) {
      setAbatError(e.response?.data?.error || 'Fehler beim Suchen');
    } finally { setAbatLoading(false); }
  };

  const handleConfirm = () => {
    if (privacyPolicy.enabled && privacyPolicy.text) {
      go('privacy');
    } else {
      doCheckin(null);
    }
  };

  const doCheckin = async (sig) => {
    setSubmitting(true);
    try {
      const res = await api.post('/preregistrations/qr/' + qrCode + '/checkin', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        company: formData.company,
        signature_base64: sig || null,
      });
      setResult(res.data);
      setCountdown(6);
      go('success');
    } catch (e) {
      setResult({ error: e.response?.data?.error || 'Fehler beim Einchecken' });
      setCountdown(6);
      go('error');
    } finally { setSubmitting(false); }
  };

  const reset = () => {
    setPrereg(null); setQrCode(null); setSignature(null);
    setResult(null); setCountdown(6); setAbatError(''); setAbatLoading(false); setSubmitting(false);
    go('scan');
  };

  const inp = 'w-full border-2 border-abat-hellgrau rounded-xl px-4 py-3 text-lg text-abat-dunkelgrau focus:outline-none focus:border-abat-blau transition-colors';

  // ── SUCCESS ──────────────────────────────────────────────────────────────
  if (state === 'success') return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col items-center justify-center px-8`}>
      <div className="max-w-xl w-full text-center">
        <div className="kiosk-pop-in w-24 h-24 rounded-full bg-abat-lichtblau/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-abat-blau" />
        </div>
        <h2 className="kiosk-fade-up kiosk-delay-1 text-3xl font-bold text-abat-dunkelgrau mb-2">{t('welcomeMsg')}</h2>
        <p className="kiosk-fade-up kiosk-delay-2 text-xl text-abat-dunkelgrau mb-1">{result?.visitor?.first_name} {result?.visitor?.last_name}</p>
        {result?.visitor?.company && <p className="kiosk-fade-up kiosk-delay-2 text-abat-grau mb-4">{result.visitor.company}</p>}
        <div className="kiosk-fade-up kiosk-delay-3 bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-3">
          {result?.visitor?.abat_id && (
            <div>
              <p className="text-xs text-abat-grau uppercase tracking-wider">abat-ID</p>
              <p className="text-2xl font-bold text-abat-blau font-mono">{result.visitor.abat_id}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-abat-grau">{t('hostLabel')}</p>
            <p className="font-semibold text-abat-dunkelgrau">{result?.visit?.host_name || '–'}</p>
          </div>
          {result?.visit?.badge_number && (
            <div>
              <p className="text-sm text-abat-grau">{t('badgeLabel')}</p>
              <p className="font-semibold text-abat-dunkelgrau">{result.visit.badge_number}</p>
            </div>
          )}
        </div>
        <p className="kiosk-fade-up kiosk-delay-4 text-abat-hellblau font-semibold">{t('hostNotified')}</p>
        <p className="kiosk-fade-up kiosk-delay-5 text-abat-grau text-sm mt-4">{t('backIn')} {countdown} {t('seconds')}</p>
      </div>
    </div>
  );

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (state === 'error') return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col items-center justify-center px-8`}>
      <div className="max-w-xl w-full text-center">
        <div className="kiosk-pop-in w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={48} className="text-red-400" />
        </div>
        <h2 className="kiosk-fade-up kiosk-delay-1 text-3xl font-bold text-abat-dunkelgrau mb-2">{t('errorTitle')}</h2>
        <p className="kiosk-fade-up kiosk-delay-2 text-abat-grau mb-6">{result?.error}</p>
        <button onClick={reset}
          className="kiosk-fade-up kiosk-delay-3 bg-abat-blau text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors active:scale-95">
          {t('retry')}
        </button>
        <p className="kiosk-fade-up kiosk-delay-4 text-abat-grau text-sm mt-4">{t('backIn')} {countdown} {t('seconds')}</p>
      </div>
    </div>
  );

  // ── CONFIRM DATA ──────────────────────────────────────────────────────────
  if (state === 'confirm') return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col`}>
      <KioskHeader onBack={reset} title="Daten bestätigen" />
      <div className="flex-1 flex flex-col justify-center px-8 py-10 max-w-2xl mx-auto w-full gap-6">
        <div>
          <h2 className="text-2xl font-bold text-abat-dunkelgrau mb-1">Sind das Ihre Daten?</h2>
          <p className="text-abat-grau text-sm">Bitte prüfen und ggf. korrigieren Sie Ihre Angaben.</p>
        </div>

        {prereg?.host_name && (
          <div className="bg-blue-50 rounded-xl p-4 text-sm">
            <span className="text-abat-grau">Gastgeber: </span>
            <span className="font-semibold text-abat-dunkelgrau">{prereg.host_name}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-abat-dunkelgrau mb-1.5"><User size={14} /> Vorname</label>
            <input className={inp} value={formData.first_name} onChange={e => setFormData(f => ({ ...f, first_name: e.target.value }))} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-abat-dunkelgrau mb-1.5"><User size={14} /> Nachname</label>
            <input className={inp} value={formData.last_name} onChange={e => setFormData(f => ({ ...f, last_name: e.target.value }))} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-abat-dunkelgrau mb-1.5"><Building2 size={14} /> Unternehmen</label>
            <input className={inp} value={formData.company} onChange={e => setFormData(f => ({ ...f, company: e.target.value }))} />
          </div>
        </div>

        <button onClick={handleConfirm}
          className="w-full bg-abat-blau text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
          Bestätigen & weiter <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  // ── PRIVACY POLICY ────────────────────────────────────────────────────────
  if (state === 'privacy') return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col`}>
      <KioskHeader onBack={() => go('confirm')} title="Datenschutzerklärung" />
      <div className="flex-1 flex flex-col px-8 py-8 max-w-2xl mx-auto w-full gap-6">
        <div>
          <h2 className="text-xl font-bold text-abat-dunkelgrau mb-1">Datenschutzerklärung lesen & unterschreiben</h2>
          <p className="text-abat-grau text-sm">Bitte lesen Sie die folgende Datenschutzerklärung und bestätigen Sie mit Ihrer Unterschrift.</p>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 border border-abat-hellgrau rounded-xl p-5 text-sm text-abat-dunkelgrau leading-relaxed max-h-64 whitespace-pre-wrap">
          {privacyPolicy.text}
        </div>

        <div>
          <SignaturePad
            label="Unterschrift"
            onSave={(dataUrl) => setSignature(dataUrl)}
            onClear={() => setSignature(null)}
          />
        </div>

        <button
          onClick={() => doCheckin(signature)}
          disabled={!signature || submitting}
          className="w-full bg-abat-blau text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98]">
          {submitting ? 'Wird eingecheckt…' : 'Unterschreiben & Einchecken'}
        </button>
      </div>
    </div>
  );

  // ── SCAN ──────────────────────────────────────────────────────────────────
  return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col`}>
      <KioskHeader onBack={() => navigate('/kiosk')} title={t('checkin')} />

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 gap-6 max-w-2xl mx-auto w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-abat-dunkelgrau mb-2">{t('scanTitle')}</h2>
          <p className="text-abat-grau">{t('scanHint')}</p>
        </div>
        <QRScanner onScan={handleQRScan} className="w-full" />
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-abat-hellgrau" />
          <span className="text-abat-grau text-sm font-medium">oder abat-ID eingeben</span>
          <div className="flex-1 h-px bg-abat-hellgrau" />
        </div>
        <AbatIdInput onSubmit={handleAbatLookup} loading={abatLoading} error={abatError} />
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-abat-hellgrau" />
          <span className="text-abat-grau text-sm font-medium">oder</span>
          <div className="flex-1 h-px bg-abat-hellgrau" />
        </div>
        <button onClick={() => navigate('/kiosk/manual')}
          className="w-full border-2 border-abat-hellgrau hover:border-abat-blau text-abat-dunkelgrau py-4 rounded-2xl font-semibold hover:bg-blue-50 transition-all active:scale-[0.98]">
          {t('checkinWithout')}
        </button>
      </div>
    </div>
  );
}
