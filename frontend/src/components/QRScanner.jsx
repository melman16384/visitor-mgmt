import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

export default function QRScanner({ onScan, onError, className = '' }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const stoppedRef = useRef(false);
  const containerId = 'qr-scanner-' + Math.random().toString(36).substr(2, 9);
  const containerIdRef = useRef(containerId);

  const startScanner = async () => {
    setError(null);
    setActive(true);
  };

  useEffect(() => {
    if (!active) return;

    stoppedRef.current = false;
    const scanner = new Html5Qrcode(containerIdRef.current);
    scannerRef.current = scanner;

    const safeStop = () => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      try { scanner.stop().catch(() => {}); } catch (e) {}
    };

    const startWithFacing = (facingMode) =>
      scanner.start(
        { facingMode },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          safeStop();
          setActive(false);
          onScan(decodedText);
        },
        () => {}
      );

    startWithFacing('user').catch(() =>
      startWithFacing('environment').catch(() => {
        setError('Kamera konnte nicht gestartet werden. Bitte Zugriff erlauben.');
        setActive(false);
      })
    );

    return () => {
      safeStop();
    };
  }, [active]);

  const stopScanner = () => {
    if (scannerRef.current) {
      try { scannerRef.current.stop().catch(() => {}); } catch (e) {}
    }
    setActive(false);
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {!active ? (
        <button
          onClick={startScanner}
          className="flex items-center gap-3 bg-abat-blau text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-primary-600 transition-colors shadow-lg"
        >
          <Camera size={24} />
          QR-Code scannen
        </button>
      ) : (
        <div className="relative w-full max-w-sm">
          <div id={containerIdRef.current} className="w-full rounded-2xl overflow-hidden" />
          <button
            onClick={stopScanner}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md"
          >
            <X size={20} className="text-abat-dunkelgrau" />
          </button>
          <p className="text-center text-sm text-abat-metallic mt-2">QR-Code vor die Kamera halten</p>
        </div>
      )}
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
    </div>
  );
}
