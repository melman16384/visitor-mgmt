import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Trash2, Check } from 'lucide-react';

export default function SignaturePad({ onSave, onClear, label = 'Unterschrift', className = '' }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255,255,255)',
      penColor: '#53565A',
      minWidth: 1.5,
      maxWidth: 3,
    });

    padRef.current.addEventListener('endStroke', () => {
      setIsEmpty(padRef.current.isEmpty());
    });

    return () => {
      padRef.current.off();
    };
  }, []);

  const clear = () => {
    padRef.current.clear();
    setIsEmpty(true);
    if (onClear) onClear();
  };

  const save = () => {
    if (padRef.current.isEmpty()) return;
    const dataURL = padRef.current.toDataURL('image/png');
    if (onSave) onSave(dataURL);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-semibold text-abat-dunkelgrau">{label}</label>
      <div className="border-2 border-abat-hellgrau rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height: '180px', display: 'block' }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-abat-grau">Bitte mit Finger oder Stift unterschreiben</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-abat-hellgrau rounded-lg text-abat-dunkelgrau hover:bg-gray-50 transition-colors"
          >
            <Trash2 size={14} />
            Löschen
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isEmpty}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-abat-blau text-white rounded-lg hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={14} />
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
