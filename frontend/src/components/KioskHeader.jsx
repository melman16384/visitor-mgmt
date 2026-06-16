import { ArrowLeft } from 'lucide-react';
import { useKioskLang } from '../context/KioskLangContext';

const FLAG  = { de: '🇩🇪', en: '🇬🇧' };
const LABEL = { de: 'DE',   en: 'EN'  };

export default function KioskHeader({ onBack, title }) {
  const { lang, setLang, languages } = useKioskLang();

  return (
    <div className="bg-abat-dunkelgrau py-5 px-8 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-abat-hellgrau hover:text-white transition-colors active:scale-90 p-1"
        >
          <ArrowLeft size={34} strokeWidth={2.5} />
        </button>
        <img src="/logo-light.png" alt="abat AG" className="h-10" />
        {title && <h1 className="text-white font-bold text-xl ml-1">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        {languages.map(l => (
          <button key={l} onClick={() => setLang(l)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              lang === l ? 'bg-abat-blau text-white' : 'bg-white/10 text-abat-hellgrau hover:bg-white/20'
            }`}>
            {FLAG[l]} {LABEL[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
