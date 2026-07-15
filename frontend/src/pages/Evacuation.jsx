import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Printer, RefreshCw, Users, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import client from '../api/client';
import { showToast } from '../components/Layout';

function CounterCard({ total, loading }) {
  const { t } = useTranslation();
  const danger = total > 0;
  return (
    <div className={`rounded-xl border p-5 shadow-sm flex items-center gap-4 ${danger ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <div className={`p-3 rounded-xl ${danger ? 'bg-red-100' : 'bg-green-100'}`}>
        <Users size={26} className={danger ? 'text-red-600' : 'text-green-600'} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t('evacuation.totalPersons')}</p>
        <p className={`text-4xl font-bold tabular-nums ${danger ? 'text-red-700' : 'text-green-700'}`}>
          {loading ? '–' : total}
        </p>
      </div>
    </div>
  );
}

function LocationSection({ location, startIndex }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
      {/* Location header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-primary-600" />
          <span className="font-semibold text-gray-800">{location.location_name}</span>
          {location.location_address && (
            <span className="text-xs text-gray-400 ml-1">· {location.location_address}</span>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-500">
          {location.visitors.length} {location.visitors.length === 1 ? t('evacuation.person') : t('evacuation.persons')}
        </span>
      </div>

      <table className="w-full text-sm">
        <thead className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
          <tr>
            <th className="text-left px-5 py-2.5 w-8">{t('evacuation.table.no')}</th>
            <th className="text-left px-5 py-2.5">{t('evacuation.table.name')}</th>
            <th className="text-left px-5 py-2.5">{t('evacuation.table.company')}</th>
            <th className="text-left px-5 py-2.5">{t('evacuation.table.host')}</th>
            <th className="text-left px-5 py-2.5">{t('evacuation.table.checkin')}</th>
            <th className="text-center px-5 py-2.5 w-16">✓</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {location.visitors.map((v, i) => (
            <tr key={v.id} className="hover:bg-gray-50 transition-colors print:hover:bg-white">
              <td className="px-5 py-3 font-mono text-gray-400 text-xs">{String(startIndex + i + 1).padStart(2, '0')}</td>
              <td className="px-5 py-3">
                <p className="font-semibold text-gray-900">{v.first_name} {v.last_name}</p>
              </td>
              <td className="px-5 py-3 text-gray-500">{v.company || '–'}</td>
              <td className="px-5 py-3 text-gray-500">{v.host_name || '–'}</td>
              <td className="px-5 py-3 text-gray-400 text-xs">
                <div className="flex items-center gap-1">
                  <Clock size={11} />
                  {v.checked_in_at ? format(new Date(v.checked_in_at), 'HH:mm', { locale: de }) : '–'}
                </div>
              </td>
              {/* Checkbox: only appears in print */}
              <td className="px-5 py-3 text-center">
                <div className="w-5 h-5 border-2 border-gray-300 rounded hidden print:inline-block" />
                <div className="w-5 h-5 border-2 border-gray-100 rounded print:hidden" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Evacuation() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await client.get('/reports/evacuation');
      setData(res.data);
      setLastUpdated(new Date());
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const t = setInterval(loadData, 30000);
    return () => clearInterval(t);
  }, [loadData]);

  const total = data?.total || 0;
  const locations = data?.locations || [];

  // Running index across all location sections
  let runningIdx = 0;

  return (
    <div className="p-6 space-y-5">
      {/* ── Screen header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('evacuation.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {t('evacuation.subtitle')}
            {lastUpdated && ` · ${t('evacuation.lastUpdated')}: ${format(lastUpdated, 'HH:mm:ss', { locale: de })}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('evacuation.refresh')}
          </button>
          <button onClick={() => window.open('/evacuation/print', '_blank')}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
            <Printer size={16} />
            {t('evacuation.printBtn')}
          </button>
        </div>
      </div>

      {/* ── Print-only header ──────────────────────────────────────────────────── */}
      <div className="hidden print:block mb-4">
        <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3 mb-1">
          <div>
            <h1 className="text-2xl font-bold tracking-wide uppercase">{t('evacuation.print.header')}</h1>
            <p className="text-sm text-gray-600 mt-0.5">{t('evacuation.print.subtitle')}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{format(now, 'HH:mm:ss')}</p>
            <p className="text-sm text-gray-500">{format(now, 'EEEE, dd. MMMM yyyy', { locale: de })}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {t('evacuation.print.note')} <strong>{total}</strong> {total === 1 ? t('evacuation.person') : t('evacuation.persons')}
        </p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        {/* Clock */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{t('evacuation.currentTime')}</p>
          <p className="text-3xl font-bold text-gray-900 font-mono">{format(now, 'HH:mm:ss')}</p>
          <p className="text-xs text-gray-400 mt-1">{format(now, 'EEEE, dd. MMMM yyyy', { locale: de })}</p>
        </div>

        {/* Person count */}
        <CounterCard total={total} loading={loading} />

        {/* Location count */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50">
            <MapPin size={26} className="text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{t('evacuation.locations')}</p>
            <p className="text-4xl font-bold tabular-nums text-gray-800">{loading ? '–' : locations.length}</p>
          </div>
        </div>
      </div>

      {/* ── Evacuation alert ───────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 no-print">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-semibold text-sm">{t('evacuation.alert.title')}</p>
            <p className="text-amber-700 text-sm mt-0.5">
              {t('evacuation.alert.all')} <strong>{total}</strong> {total === 1 ? t('evacuation.person') : t('evacuation.persons')} {t('evacuation.alert.text')}
            </p>
          </div>
        </div>
      )}

      {/* ── Location groups ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-center py-20 text-gray-400">
          <Users size={40} className="mx-auto mb-3 text-gray-200" />
          {t('evacuation.noVisitors')}
        </div>
      ) : (
        <div className="space-y-5">
          {locations.map(loc => {
            const section = <LocationSection key={loc.location_name} location={loc} startIndex={runningIdx} />;
            runningIdx += loc.visitors.length;
            return section;
          })}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      {data?.generated_at && (
        <p className="text-xs text-gray-300 text-right no-print">
          {t('evacuation.generated')}: {format(new Date(data.generated_at), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
        </p>
      )}
    </div>
  );
}
