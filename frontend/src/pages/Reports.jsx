import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Users, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const defaultFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const defaultTo = format(new Date(), 'yyyy-MM-dd');

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState([]);
  const [data, setData] = useState(null);
  const [allVisits, setAllVisits] = useState([]);
  const [hostFilter, setHostFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [checkinDateFilter, setCheckinDateFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) client.get('/locations').then(r => setLocations(r.data)).catch(() => {});
  }, [isAdmin]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from, to, format: 'json' };
      if (isAdmin && locationId) params.location_id = locationId;
      const exportRes = await client.get('/reports/export', { params });

      // Calculate stats from export data
      const fetchedVisits = exportRes.data;

      // Group by day for chart (local calendar day, not UTC)
      const byDay = {};
      fetchedVisits.forEach(v => {
        if (!v.checked_in_at) return;
        const day = format(new Date(v.checked_in_at), 'yyyy-MM-dd');
        byDay[day] = (byDay[day] || 0) + 1;
      });
      const chartData = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

      setData({ total: fetchedVisits.length, chart: chartData });
      setAllVisits(fetchedVisits);
    } catch {
      showToast(t('reports.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, locationId, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExportCSV = () => {
    const locParam = isAdmin && locationId ? `&location_id=${locationId}` : '';
    const url = `/api/reports/export?from=${from}&to=${to}&format=csv${locParam}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `besucher-export-${from}-${to}.csv`;
    const token = localStorage.getItem('token');
    // Open with auth token in new window (token in URL not ideal, but for file download)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      })
      .catch(() => showToast(t('reports.exportError'), 'error'));
  };

  const formatDate = (d) => {
    try { return format(parseISO(d), 'dd.MM', { locale: de }); } catch { return d; }
  };

  const hostOptions = [...new Set(allVisits.map(v => v.host_name).filter(Boolean))].sort();

  const filteredVisits = allVisits.filter(v => {
    if (hostFilter && v.host_name !== hostFilter) return false;
    if (nameFilter && !`${v.first_name} ${v.last_name}`.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (checkinDateFilter && v.checked_in_at && format(new Date(v.checked_in_at), 'yyyy-MM-dd') !== checkinDateFilter) return false;
    return true;
  });
  const visibleVisits = filteredVisits.slice(0, 50);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('reports.subtitle')}</p>
        </div>
        {isAdmin && (
          <button onClick={handleExportCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
            <Download size={18} />
            {t('reports.csvExport')}
          </button>
        )}
      </div>

      {/* Date range */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{t('reports.from')}</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{t('reports.to')}</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Standort</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Alle Standorte</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={loadData} disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? t('common.loading') : t('reports.analyze')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-3 rounded-xl"><Users size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('reports.totalVisits')}</p>
                <p className="text-2xl font-bold text-gray-900">{data.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-3 rounded-xl"><TrendingUp size={20} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('reports.period')}</p>
                <p className="text-sm font-bold text-gray-900">{format(parseISO(from), 'dd.MM.yy', { locale: de })} – {format(parseISO(to), 'dd.MM.yy', { locale: de })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {data?.chart?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t('reports.chartTitle')}</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [v, t('reports.visits')]}
                  labelFormatter={(l) => formatDate(l)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Visits table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">{t('reports.tableTitle')}</h2>
          <span className="text-sm text-gray-500">{visibleVisits.length} / {filteredVisits.length} {t('reports.tableMax')}</span>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 bg-gray-50/50">
          <input type="text" placeholder="Name des Besuchers..." value={nameFilter} onChange={e => setNameFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <select value={hostFilter} onChange={e => setHostFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Alle Gastgeber</option>
            {hostOptions.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <input type="date" value={checkinDateFilter} onChange={e => setCheckinDateFilter(e.target.value)}
            title="Nach Check-in-Datum filtern"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          {(nameFilter || hostFilter || checkinDateFilter) && (
            <button onClick={() => { setNameFilter(''); setHostFilter(''); setCheckinDateFilter(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Filter zurücksetzen</button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">{t('reports.table.visitor')}</th>
                <th className="text-left px-6 py-3">{t('reports.table.host')}</th>
                <th className="text-left px-6 py-3">{t('reports.table.purpose')}</th>
                <th className="text-left px-6 py-3">{t('reports.table.checkedIn')}</th>
                <th className="text-left px-6 py-3">{t('reports.table.checkedOut')}</th>
                <th className="text-left px-6 py-3">{t('reports.table.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </td></tr>
              ) : visibleVisits.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                  {t('reports.noData')}
                </td></tr>
              ) : visibleVisits.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{v.first_name} {v.last_name}</p>
                    <p className="text-xs text-gray-400">{v.company || '–'}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{v.host_name || '–'}</td>
                  <td className="px-6 py-3 text-gray-600">{v.purpose || '–'}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {v.checked_in_at ? format(new Date(v.checked_in_at), 'dd.MM.yy HH:mm', { locale: de }) : '–'}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {v.checked_out_at ? format(new Date(v.checked_out_at), 'dd.MM.yy HH:mm', { locale: de }) : '–'}
                  </td>
                  <td className="px-6 py-3">
                    {v.status === 'active'
                      ? <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{t('reports.present')}</span>
                      : <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{t('reports.checkedOut')}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
