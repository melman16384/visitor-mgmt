import React, { useEffect, useState } from 'react';
import client from '../api/client';

export default function EvacuationPrint() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const now = new Date();

  useEffect(() => {
    client.get('/reports/evacuation')
      .then(res => {
        setData(res.data);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (data !== null) {
      setTimeout(() => window.print(), 300);
    }
  }, [data]);

  const pad = n => String(n).padStart(2, '0');
  const formatTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const formatDate = d =>
    d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const formatCheckin = iso => {
    if (!iso) return '–';
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (error) return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, color: '#c00' }}>
      Fehler beim Laden der Evakuierungsdaten.
    </div>
  );

  if (!data) return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, color: '#666' }}>
      Wird geladen…
    </div>
  );

  const total = data.total || 0;
  const locations = data.locations || [];
  let runningIdx = 0;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #fff; }
        @media screen { body { padding: 24px; max-width: 900px; margin: 0 auto; } }
        @media print {
          @page { size: A4 portrait; margin: 15mm 12mm; }
          body { font-size: 11px; }
          .no-print { display: none !important; }
        }

        .page-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
        .page-header h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
        .page-header .meta { text-align: right; font-size: 11px; color: #444; }
        .page-header .time { font-size: 20px; font-weight: bold; }
        .summary { font-size: 11px; color: #444; margin-bottom: 16px; }
        .summary strong { color: #000; }

        .location-block { margin-bottom: 20px; page-break-inside: avoid; }
        .location-header { background: #f0f0f0; border: 1px solid #ccc; border-bottom: none; padding: 5px 8px; display: flex; justify-content: space-between; align-items: center; }
        .location-name { font-weight: bold; font-size: 12px; }
        .location-address { font-size: 10px; color: #666; margin-left: 6px; }
        .location-count { font-size: 11px; color: #444; }

        table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; }
        th { background: #e8e8e8; border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
        td { border: 1px solid #ddd; padding: 5px 6px; vertical-align: top; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .col-no { width: 32px; color: #888; font-size: 10px; }
        .col-name { font-weight: bold; }
        .col-time { font-size: 10px; color: #666; }
        .col-check { width: 28px; text-align: center; }
        .checkbox { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #555; }

        .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: right; }
        .no-visitors { text-align: center; padding: 40px; color: #666; font-size: 14px; }
        .print-btn { margin-bottom: 16px; }
        .print-btn button { background: #004B87; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; cursor: pointer; }
        .print-btn button:hover { background: #003a6b; }
      `}</style>

      <div className="no-print print-btn">
        <button onClick={() => window.print()}>Drucken</button>
      </div>

      <div className="page-header">
        <div>
          <h1>⚠ Evakuierungsliste</h1>
          <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>
            Alle aktuell im Gebäude anwesenden Personen
          </div>
        </div>
        <div className="meta">
          <div className="time">{formatTime(now)}</div>
          <div>{formatDate(now)}</div>
        </div>
      </div>

      <div className="summary">
        Gesamt anwesend: <strong>{total} {total === 1 ? 'Person' : 'Personen'}</strong>
        {locations.length > 1 && <> &nbsp;·&nbsp; <strong>{locations.length} Standorte</strong></>}
      </div>

      {total === 0 ? (
        <div className="no-visitors">Keine Besucher aktuell im Gebäude.</div>
      ) : (
        locations.map(loc => {
          const sectionStart = runningIdx;
          runningIdx += loc.visitors.length;
          return (
            <div className="location-block" key={loc.location_name}>
              <div className="location-header">
                <div>
                  <span className="location-name">{loc.location_name}</span>
                  {loc.location_address && (
                    <span className="location-address">· {loc.location_address}</span>
                  )}
                </div>
                <span className="location-count">
                  {loc.visitors.length} {loc.visitors.length === 1 ? 'Person' : 'Personen'}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th className="col-no">Nr.</th>
                    <th>Name</th>
                    <th>Firma</th>
                    <th>Gastgeber</th>
                    <th>Check-in</th>
                    <th className="col-check">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {loc.visitors.map((v, i) => (
                    <tr key={v.id}>
                      <td className="col-no">{String(sectionStart + i + 1).padStart(2, '0')}</td>
                      <td className="col-name">{v.first_name} {v.last_name}</td>
                      <td>{v.company || '–'}</td>
                      <td>{v.host_name || '–'}</td>
                      <td className="col-time">{formatCheckin(v.checked_in_at)}</td>
                      <td className="col-check"><span className="checkbox" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      <div className="footer">
        Erstellt: {now.toLocaleString('de-DE')} &nbsp;·&nbsp; Besucherverwaltung abat AG
      </div>
    </>
  );
}
