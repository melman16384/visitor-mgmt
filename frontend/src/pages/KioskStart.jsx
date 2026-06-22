import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { useKioskLang } from '../context/KioskLangContext';
import useKioskIdle from '../hooks/useKioskIdle';
import KioskScreensaver from '../components/KioskScreensaver';

const FLAG  = { de: '🇩🇪', en: '🇬🇧' };
const LABEL = { de: 'DE',   en: 'EN'  };

export default function KioskStart() {
  const navigate = useNavigate();
  const { t, lang, setLang, languages } = useKioskLang();
  const [screensaver, setScreensaver] = useState(false);

  useKioskIdle(3 * 60 * 1000, () => setScreensaver(true));

  if (screensaver) return <KioskScreensaver onDismiss={() => setScreensaver(false)} />;

  return (
    <div className="min-h-screen bg-abat-dunkelgrau flex flex-col select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-10 pt-10 pb-0">
        <img src="/logo-light.png" alt="abat AG" className="kiosk-fade-up h-11" />
        <div className="kiosk-fade-up flex items-center gap-2">
          {languages.map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all ${
                lang === l
                  ? 'bg-abat-blau text-white shadow-lg'
                  : 'text-abat-hellgrau hover:text-white border border-white/20 hover:border-white/40'
              }`}>
              {FLAG[l]} {LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-8">

        {/* Eyebrow */}
        <p className="kiosk-fade-up kiosk-delay-1 text-abat-lichtblau text-xs font-bold tracking-[0.25em] uppercase mb-6">
          Besucherverwaltung
        </p>

        {/* Headline */}
        <h1 className="kiosk-fade-up kiosk-delay-1 text-5xl font-black text-white text-center leading-tight mb-3">
          {t('welcome')}
        </h1>
        <p className="kiosk-fade-up kiosk-delay-2 text-abat-hellgrau text-lg text-center mb-14 max-w-sm">
          {t('pleaseChoose')}
        </p>

        {/* Action buttons */}
        <div className="kiosk-fade-up kiosk-delay-2 w-full max-w-md flex flex-col gap-4">

          {/* Check-in — primary */}
          <button
            onClick={() => navigate('/kiosk/checkin')}
            className="group w-full bg-abat-blau hover:bg-primary-600 active:scale-[0.98] text-white rounded-2xl px-8 py-7 transition-all shadow-xl hover:shadow-2xl flex items-center gap-6">
            <div className="bg-white/15 group-hover:bg-white/20 transition-colors rounded-xl p-3.5 flex-shrink-0">
              <LogIn size={30} strokeWidth={2} />
            </div>
            <div className="text-left">
              <p className="text-2xl font-black tracking-tight">{t('checkin')}</p>
              <p className="text-white/65 text-sm font-medium mt-0.5">{t('checkinSub')}</p>
            </div>
          </button>

          {/* Check-out — secondary */}
          <button
            onClick={() => navigate('/kiosk/checkout')}
            className="group w-full bg-white/8 hover:bg-white/14 active:scale-[0.98] border border-white/20 hover:border-white/35 text-white rounded-2xl px-8 py-7 transition-all flex items-center gap-6">
            <div className="bg-white/10 group-hover:bg-white/15 transition-colors rounded-xl p-3.5 flex-shrink-0">
              <LogOut size={30} strokeWidth={2} className="text-abat-hellgrau" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-black tracking-tight">{t('checkout')}</p>
              <p className="text-white/50 text-sm font-medium mt-0.5">{t('checkoutSub')}</p>
            </div>
          </button>

        </div>
      </div>

      {/* Footer */}
      <div className="kiosk-fade-up kiosk-delay-5 py-6 text-center">
        <p className="text-abat-grau text-xs">{t('questions')}</p>
      </div>

    </div>
  );
}
