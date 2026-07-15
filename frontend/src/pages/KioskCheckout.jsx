import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Search, AlertTriangle } from 'lucide-react';
import QRScanner from '../components/QRScanner';
import KioskHeader from '../components/KioskHeader';
import api from '../api/client';
import { useKioskLang } from '../context/KioskLangContext';
import useKioskIdle from '../hooks/useKioskIdle';

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
      <p className="text-abat-grau text-sm text-center">Geben Sie Ihre abat-ID ein</p>
      <div className="flex items-center gap-0 border-2 border-abat-hellgrau focus-within:border-abat-blau rounded-2xl overflow-hidden transition-colors w-full">
        <span className="bg-gray-100 px-4 py-4 text-xl font-mono font-bold text-abat-dunkelgrau select-none border-r border-abat-hellgrau whitespace-nowrap">
          ABAT-
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={digits}
          onChange={handleChange}
          placeholder="00000000"
          maxLength={8}
          className="flex-1 px-4 py-4 text-xl font-mono tracking-widest text-abat-dunkelgrau placeholder-abat-hellgrau focus:outline-none bg-white"
        />
      </div>
      <p className="text-xs text-abat-grau">
        {digits.length}/8 Ziffern
        {digits.length === 8 && !loading && <span className="text-green-600 ml-2">✓ Wird gesucht…</span>}
      </p>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
    </div>
  );
}

export default function KioskCheckout() {
  const navigate = useNavigate();
  const { t } = useKioskLang();

  useKioskIdle(60_000, () => navigate('/kiosk'));

  const [tab, setTab] = useState('scan');
  const [tabKey, setTabKey] = useState(0);
  const [state, setState] = useState('idle');
  const [animKey, setAnimKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [searching, setSearching] = useState(false);
  const [abatLoading, setAbatLoading] = useState(false);
  const [abatError, setAbatError] = useState('');

  useEffect(() => {
    if (state === 'success' || state === 'error') {
      const timer = setInterval(() => {
        setCountdown(c => { if (c <= 1) { clearInterval(timer); navigate('/kiosk'); } return c - 1; });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, navigate]);

  const switchTab = (newTab) => {
    setTab(newTab);
    setTabKey(k => k + 1);
    setState('idle');
    setAbatError('');
    setAbatLoading(false);
  };

  const showSuccess = (data) => {
    setResult(data);
    setAnimKey(k => k + 1);
    setState('success');
    setCountdown(5);
  };

  const showError = (err) => {
    setResult(err);
    setAnimKey(k => k + 1);
    setState('error');
    setCountdown(5);
  };

  const handleQRScan = async (qrCode) => {
    try {
      const res = await api.post('/visits/checkout-by-qr', { qr_code: qrCode });
      showSuccess(res.data);
    } catch (e) {
      showError({ error: e.response?.data?.error || 'QR-Code nicht gefunden' });
    }
  };

  const handleAbatCheckout = async (abatId) => {
    setAbatLoading(true);
    setAbatError('');
    try {
      const res = await api.post('/visits/checkout-by-abat-id', { abat_id: abatId });
      showSuccess(res.data);
    } catch (e) {
      setAbatError(e.response?.data?.error || 'abat-ID nicht gefunden');
      setAbatLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setSearching(true);
    try {
      const res = await api.get('/visits/search-active', { params: { q: searchQuery } });
      setSearchResults(res.data);
      setState('results');
    } catch { setSearchResults([]); setState('results'); }
    finally { setSearching(false); }
  };

  const handleCheckoutById = async (visitId) => {
    try {
      await api.post(`/visits/${visitId}/checkout`);
      const visit = searchResults.find(v => v.id === visitId);
      showSuccess({ visitor: { first_name: visit.first_name, last_name: visit.last_name, company: visit.company } });
    } catch (e) {
      showError({ error: e.response?.data?.error || 'Fehler' });
    }
  };

  const reset = () => {
    setAnimKey(k => k + 1);
    setState('idle');
    setResult(null);
    setCountdown(5);
    setAbatError('');
    setAbatLoading(false);
  };

  if (state === 'success') return (
    <div key={animKey} className="kiosk-fade-up min-h-screen bg-white flex flex-col items-center justify-center px-8">
      <div className="max-w-xl w-full text-center">
        <div className="kiosk-pop-in w-24 h-24 rounded-full bg-abat-lichtblau/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-abat-blau" />
        </div>
        <h2 className="kiosk-fade-up kiosk-delay-1 text-3xl font-bold text-abat-dunkelgrau mb-2">{t('goodbye')}</h2>
        <p className="kiosk-fade-up kiosk-delay-2 text-xl text-abat-dunkelgrau mb-1">{result?.visitor?.first_name} {result?.visitor?.last_name}</p>
        {result?.visitor?.company && <p className="kiosk-fade-up kiosk-delay-2 text-abat-grau mb-2">{result.visitor.company}</p>}
        {result?.visitor?.abat_id && (
          <p className="kiosk-fade-up kiosk-delay-3 font-mono text-sm text-abat-blau font-semibold mb-4">{result.visitor.abat_id}</p>
        )}
        <p className="kiosk-fade-up kiosk-delay-3 text-abat-hellblau font-semibold">{t('checkedOut')}</p>
        <p className="kiosk-fade-up kiosk-delay-4 text-abat-grau text-sm mt-4">{t('backIn')} {countdown} {t('seconds')}</p>
      </div>
    </div>
  );

  if (state === 'error') return (
    <div key={animKey} className="kiosk-fade-up min-h-screen bg-white flex flex-col items-center justify-center px-8">
      <div className="max-w-xl w-full text-center">
        <div className="kiosk-pop-in w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={48} className="text-red-400" />
        </div>
        <h2 className="kiosk-fade-up kiosk-delay-1 text-3xl font-bold text-abat-dunkelgrau mb-2">{t('notFound')}</h2>
        <p className="kiosk-fade-up kiosk-delay-2 text-abat-grau mb-6">{result?.error}</p>
        <button onClick={reset}
          className="kiosk-fade-up kiosk-delay-3 bg-abat-blau text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors active:scale-95">
          {t('back')}
        </button>
        <p className="kiosk-fade-up kiosk-delay-4 text-abat-grau text-sm mt-4">{t('backIn')} {countdown} {t('seconds')}</p>
      </div>
    </div>
  );

  return (
    <div className="kiosk-fade-up min-h-screen bg-white flex flex-col">
      <KioskHeader onBack={() => navigate('/kiosk')} title={t('checkout')} />

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-8 gap-6 max-w-2xl mx-auto w-full">
        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 w-full">
          {[
            { key: 'scan', label: t('scanQR') },
            { key: 'abat', label: 'abat-ID' },
            { key: 'search', label: t('searchName') },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => switchTab(key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-white text-abat-dunkelgrau shadow-sm'
                  : 'text-abat-grau hover:text-abat-dunkelgrau'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content — re-mounts with fade on tab switch */}
        <div key={tabKey} className="kiosk-fade-up w-full flex flex-col items-center gap-4">
          {tab === 'scan' && (
            <>
              <p className="text-abat-grau text-center text-sm">{t('scanBadge')}</p>
              <QRScanner onScan={handleQRScan} className="w-full" />
            </>
          )}

          {tab === 'abat' && (
            <AbatIdInput onSubmit={handleAbatCheckout} loading={abatLoading} error={abatError} />
          )}

          {tab === 'search' && (
            <div className="w-full flex flex-col gap-4">
              <div className="flex gap-2">
                <input type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder={t('searchPlaceholder')}
                  className="flex-1 border-2 border-abat-hellgrau rounded-xl px-4 py-3 text-abat-dunkelgrau focus:outline-none focus:border-abat-blau transition-colors" />
                <button onClick={handleSearch} disabled={searching}
                  className="bg-abat-blau text-white px-4 py-3 rounded-xl hover:bg-primary-600 transition-colors active:scale-95">
                  <Search size={20} />
                </button>
              </div>
              {state === 'results' && (
                <div className="kiosk-fade-up flex flex-col gap-2">
                  {searchResults.length === 0 ? (
                    <p className="text-center text-abat-grau py-6">{t('noVisitorsFound')}</p>
                  ) : searchResults.map((visit, i) => (
                    <button key={visit.id} onClick={() => handleCheckoutById(visit.id)}
                      className="kiosk-fade-up flex items-center justify-between bg-gray-50 hover:bg-blue-50 hover:border-abat-blau border-2 border-transparent rounded-xl p-4 transition-all text-left active:scale-[0.99]"
                      style={{ animationDelay: `${i * 0.06}s` }}>
                      <div>
                        <p className="font-semibold text-abat-dunkelgrau">{visit.first_name} {visit.last_name}</p>
                        <p className="text-sm text-abat-grau">{visit.company}</p>
                        <p className="text-xs text-abat-grau">{t('hostLabel')}: {visit.host_name}</p>
                      </div>
                      <span className="text-abat-blau text-sm font-semibold">{t('checkoutAction')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
