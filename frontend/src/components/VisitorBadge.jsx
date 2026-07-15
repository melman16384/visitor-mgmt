import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function VisitorBadge({ visitor, visit, host }) {
  const checkinDate = visit?.checked_in_at ? new Date(visit.checked_in_at) : new Date();
  return (
    <div className="w-72 border-2 border-blue-800 rounded-xl overflow-hidden shadow-lg font-sans">
      <div className="bg-primary-800 text-white text-center py-4">
        <p className="text-2xl font-bold tracking-widest">BESUCHER</p>
      </div>
      <div className="bg-white p-4">
        <p className="text-xl font-bold text-gray-900">{visitor?.first_name} {visitor?.last_name}</p>
        <p className="text-sm text-gray-500">{visitor?.company || ''}</p>
        <hr className="my-3 border-gray-200" />
        <p className="text-xs text-gray-400 uppercase tracking-wide">Besucht</p>
        <p className="font-semibold text-gray-800">{host?.name || visit?.host_name || '–'}</p>
        <p className="text-xs text-gray-400 mt-3 uppercase tracking-wide">Datum &amp; Uhrzeit</p>
        <p className="text-sm font-medium text-gray-700">
          {format(checkinDate, 'dd.MM.yyyy HH:mm', { locale: de })} Uhr
        </p>
      </div>
      <div className="bg-gray-50 text-center py-2">
        <p className="text-xs text-gray-400">Bitte sichtbar tragen</p>
      </div>
    </div>
  );
}
