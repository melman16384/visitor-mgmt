import { useState, useEffect } from 'react';

export default function KioskScreensaver({ onDismiss }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 bg-abat-dunkelgrau flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ animation: 'kioskFadeUp 0.4s ease both' }}>

      {/* Logo */}
      <img src="/logo-light.png" alt="abat AG" className="h-14 mb-16 opacity-70" />

      {/* Time */}
      <p className="text-white font-black tabular-nums leading-none"
        style={{ fontSize: 'clamp(5rem, 18vw, 9rem)', letterSpacing: '-0.03em' }}>
        {timeStr}
      </p>

      {/* Date */}
      <p className="text-abat-hellgrau text-xl font-medium mt-4 capitalize">{dateStr}</p>

      {/* Blue accent line */}
      <div className="mt-16 w-24 h-0.5 bg-gradient-to-r from-abat-blau via-abat-hellblau to-abat-lichtblau rounded-full" />

      {/* Hint */}
      <p className="text-abat-grau text-sm mt-6 animate-pulse">Zum Starten bitte tippen</p>
    </div>
  );
}
