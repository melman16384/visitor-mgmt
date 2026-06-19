import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import KioskHeader from '../components/KioskHeader';
import api from '../api/client';
import { useKioskLang } from '../context/KioskLangContext';

const STATE_RANK = { form: 0, privacy: 1, success: 2, error: 2 };

export default function KioskManual() {
  const navigate = useNavigate();
  const { t } = useKioskLang();

  const [state, setState] = useState('form');
  const [animKey, setAnimKey] = useState(0);
  const dirRef = useRef('forward');

  const [hosts, setHosts] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [form, setForm] = useState({ first_name: '', last_name: '', company: '', host_id: '', purpose: '', notes: '' });
  const [hostManualName, setHostManualName] = useState('');
  const [signature, setSignature] = useState(null);
  const [privacyPolicy, setPrivacyPolicy] = useState({ text: '', enabled: false });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/hosts').then(r => setHosts(r.data.hosts || r.data)).catch(() => {});
    api.get('/visit-purposes').then(r => {
      setPurposes(r.data);
      if (r.data.length > 0) setForm(f => ({ ...f, purpose: r.data[0].name }));
    }).catch(() => {});
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

  const isManualHost = form.host_id === '_manual';

  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = t('required');
    if (!form.last_name.trim()) e.last_name = t('required');
    if (!form.host_id) e.host_id = t('required');
    if (isManualHost && !hostManualName.trim()) e.host_id = t('required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (privacyPolicy.enabled && privacyPolicy.text) {
      go('privacy');
    } else {
      doCheckin(null);
    }
  };

  const doCheckin = async (sig) => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        host_id: isManualHost ? null : Number(form.host_id),
        host_name_free: isManualHost ? hostManualName.trim() : null,
        signature_base64: sig || null,
      };
      const res = await api.post('/visitors', payload);
      setResult(res.data);
      setCountdown(6);
      go('success');
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Fehler beim Einchecken' });
      setCountdown(6);
      go('error');
    } finally {
      setLoading(false);
    }
  };

  // ── SUCCESS ──────────────────────────────────────────────────────────────
  if (state === 'success') return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col items-center justify-center px-8`}>
      <div className="max-w-xl w-full text-center">
        <div className="kiosk-pop-in w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-green-500" />
        </div>
        <h2 className="kiosk-fade-up kiosk-delay-1 text-3xl font-bold text-abat-dunkelgrau mb-2">{t('welcomeMsg')}</h2>
        <p className="kiosk-fade-up kiosk-delay-2 text-xl text-abat-dunkelgrau">{result?.visitor?.first_name} {result?.visitor?.last_name}</p>
        {result?.visitor?.company && <p className="kiosk-fade-up kiosk-delay-2 text-abat-metallic mb-4">{result.visitor.company}</p>}
        <div className="kiosk-fade-up kiosk-delay-3 bg-gray-50 rounded-2xl p-4 mb-4 space-y-3">
          {result?.visitor?.abat_id && (
            <div>
              <p className="text-xs text-abat-metallic uppercase tracking-wider">abat-ID</p>
              <p className="text-2xl font-bold text-abat-blau font-mono">{result.visitor.abat_id}</p>
            </div>
          )}
          {result?.visit?.badge_number && (
            <div>
              <p className="text-sm text-abat-metallic">{t('badgeNumber')}</p>
              <p className="text-lg font-semibold text-abat-dunkelgrau">{result.visit.badge_number}</p>
            </div>
          )}
        </div>
        {result?.visit?.host_name_free
          ? <p className="kiosk-fade-up kiosk-delay-4 text-abat-metallic text-sm">{t('hostNotifiedManual')}</p>
          : <p className="kiosk-fade-up kiosk-delay-4 text-abat-hellblau font-semibold">{t('hostNotified')}</p>
        }
        <p className="kiosk-fade-up kiosk-delay-5 text-abat-metallic text-sm mt-4">{t('backIn')} {countdown} {t('seconds')}</p>
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
        <p className="kiosk-fade-up kiosk-delay-2 text-abat-metallic mb-6">{result?.error}</p>
        <button onClick={() => { setResult(null); setCountdown(6); go('form'); }}
          className="kiosk-fade-up kiosk-delay-3 bg-abat-blau text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors active:scale-95">
          {t('retry')}
        </button>
        <p className="kiosk-fade-up kiosk-delay-4 text-abat-metallic text-sm mt-4">{t('backIn')} {countdown} {t('seconds')}</p>
      </div>
    </div>
  );

  // ── PRIVACY POLICY ────────────────────────────────────────────────────────
  if (state === 'privacy') return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col`}>
      <KioskHeader onBack={() => go('form')} title="Datenschutzerklärung" />
      <div className="flex-1 flex flex-col px-8 py-8 max-w-2xl mx-auto w-full gap-6">
        <div>
          <h2 className="text-xl font-bold text-abat-dunkelgrau mb-1">Datenschutzerklärung lesen & unterschreiben</h2>
          <p className="text-abat-metallic text-sm">Bitte lesen Sie die folgende Datenschutzerklärung und bestätigen Sie mit Ihrer Unterschrift.</p>
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
          disabled={!signature || loading}
          className="w-full bg-abat-blau text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98]">
          {loading ? 'Wird eingecheckt…' : 'Unterschreiben & Einchecken'}
        </button>
      </div>
    </div>
  );

  // ── FORM ──────────────────────────────────────────────────────────────────
  const inp = (extra) => `w-full border-2 rounded-xl px-4 py-3 focus:outline-none transition-colors ${extra}`;

  return (
    <div key={animKey} className={`${animClass} min-h-screen bg-white flex flex-col`}>
      <KioskHeader onBack={() => navigate('/kiosk')} title={t('manualTitle')} />

      <div className="flex-1 overflow-y-auto px-8 py-8 max-w-2xl mx-auto w-full">
        <h2 className="text-xl font-bold text-abat-dunkelgrau mb-6">{t('fillForm')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-abat-dunkelgrau block mb-1">{t('firstName')} *</label>
              <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className={inp(errors.first_name ? 'border-red-400' : 'border-abat-hellgrau focus:border-abat-blau')} />
              {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-abat-dunkelgrau block mb-1">{t('lastName')} *</label>
              <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className={inp(errors.last_name ? 'border-red-400' : 'border-abat-hellgrau focus:border-abat-blau')} />
              {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-abat-dunkelgrau block mb-1">{t('company')}</label>
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              className={inp('border-abat-hellgrau focus:border-abat-blau')} />
          </div>

          <div>
            <label className="text-sm font-semibold text-abat-dunkelgrau block mb-1">{t('host')} *</label>
            <select
              value={form.host_id}
              onChange={e => { setForm(f => ({ ...f, host_id: e.target.value })); setHostManualName(''); }}
              className={inp(`bg-white ${errors.host_id ? 'border-red-400' : 'border-abat-hellgrau focus:border-abat-blau'}`)}>
              <option value="">{t('hostPlaceholder')}</option>
              {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              <option value="_manual">{t('hostManualOption')}</option>
            </select>
            {isManualHost && (
              <input
                value={hostManualName}
                onChange={e => setHostManualName(e.target.value)}
                placeholder={t('hostManualPlaceholder')}
                className={inp(`mt-2 ${errors.host_id && !hostManualName.trim() ? 'border-red-400' : 'border-abat-hellgrau focus:border-abat-blau'}`)}
              />
            )}
            {errors.host_id && <p className="text-red-500 text-xs mt-1">{errors.host_id}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold text-abat-dunkelgrau block mb-1">{t('purpose')}</label>
            <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              className={inp('bg-white border-abat-hellgrau focus:border-abat-blau')}>
              {purposes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-abat-blau text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary-600 disabled:opacity-50 transition-colors mt-2 active:scale-[0.98]">
            {loading ? t('checkinLoading') : (privacyPolicy.enabled && privacyPolicy.text ? 'Weiter →' : t('checkinBtn'))}
          </button>
        </form>
      </div>
    </div>
  );
}
