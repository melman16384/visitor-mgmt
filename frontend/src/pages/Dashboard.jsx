import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserCheck, UserMinus, Calendar, LogOut, UserPlus, Search, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import StatCard from '../components/StatCard';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useTranslation } from 'react-i18next';
import VisitorCheckinForm from '../components/VisitorCheckinForm';

function StatusBadge({ status }) {
  const { t } = useTranslation();
  if (status === 'active') return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{t('status.active')}</span>;
  if (status === 'completed') return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{t('status.completed')}</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">{status}</span>;
}

function InitialsAvatar({ name }) {
  const initials = name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
  const color = colors[name?.charCodeAt(0) % colors.length] || colors[0];
  return (
    <div className={`w-8 h-8 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

function CheckinModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [hosts, setHosts] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([client.get('/hosts'), client.get('/visit-purposes')]).then(([h, p]) => {
      setHosts(h.data.filter(x => x.active));
      setPurposes(p.data.filter(x => x.active));
    });
  }, []);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      await client.post('/visitors', form);
      showToast(t('visitors.checkedIn'));
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus size={16} className="text-primary-600" /> {t('dashboard.checkinBtn')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6">
          <VisitorCheckinForm onSubmit={handleSubmit} hosts={hosts} purposes={purposes} loading={submitting} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [statsRes, chartRes, recentRes] = await Promise.all([
        client.get('/dashboard/stats'),
        client.get('/dashboard/chart'),
        client.get('/dashboard/recent'),
      ]);
      setStats(statsRes.data);
      setChart(chartRes.data);
      setRecent(recentRes.data);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCheckout = async (visitId) => {
    setCheckingOut(visitId);
    try {
      await client.post(`/visits/${visitId}/checkout`);
      showToast(t('visitors.checkedOut'));
      loadData();
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setCheckingOut(null);
    }
  };

  const formatChartDate = (dateStr) => {
    try { return format(parseISO(dateStr), 'dd.MM', { locale: de }); }
    catch { return dateStr; }
  };

  const filteredRecent = search
    ? recent.filter(v => `${v.first_name} ${v.last_name} ${v.company || ''} ${v.abat_id || ''}`.toLowerCase().includes(search.toLowerCase()))
    : recent;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {showCheckin && <CheckinModal onClose={() => setShowCheckin(false)} onSuccess={loadData} />}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
        </div>
        <button
          onClick={() => setShowCheckin(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
        >
          <UserPlus size={16} /> {t('common.checkin')}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.today')} value={stats?.todayTotal} icon={Users} color="blue" />
        <StatCard title={t('dashboard.currentlyPresent')} value={stats?.currentlyIn} icon={UserCheck} color="green" />
        <StatCard title={t('dashboard.checkedOut')} value={stats?.checkedOutToday} icon={UserMinus} color="yellow" />
        <StatCard title={t('dashboard.thisWeek')} value={stats?.thisWeekTotal} icon={Calendar} color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t('dashboard.visitor')} – {t('reports.chartTitle')}</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatChartDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [v, t('dashboard.visitor')]}
                  labelFormatter={(l) => formatChartDate(l)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t('dashboard.recentVisits')}</h2>
          <div className="space-y-4">
            {[
              { label: t('dashboard.thisMonth'), value: stats?.thisMonthTotal, icon: Calendar, color: 'text-blue-600' },
              { label: t('dashboard.currentlyPresent'), value: stats?.currentlyIn, icon: UserCheck, color: 'text-green-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <Icon size={16} className={color} />
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent visitors */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-900 whitespace-nowrap">{t('dashboard.recentVisits')}</h2>
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('visitors.searchPlaceholder')}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">{t('dashboard.table.visitor')}</th>
                <th className="text-left px-6 py-3">{t('visitors.table.abatId')}</th>
                <th className="text-left px-6 py-3">{t('dashboard.table.host')}</th>
                <th className="text-left px-6 py-3">{t('common.purpose')}</th>
                <th className="text-left px-6 py-3">{t('dashboard.table.checkedIn')}</th>
                <th className="text-left px-6 py-3">{t('dashboard.table.status')}</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRecent.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={`${v.first_name} ${v.last_name}`} />
                      <div>
                        <p className="font-medium text-gray-900">{v.first_name} {v.last_name}</p>
                        <p className="text-xs text-gray-400">{v.company || '–'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {v.abat_id
                      ? <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded-md">{v.abat_id}</span>
                      : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{v.host_name || '–'}</td>
                  <td className="px-6 py-4 text-gray-600">{v.purpose || '–'}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {v.checked_in_at ? format(new Date(v.checked_in_at), 'dd.MM. HH:mm', { locale: de }) : '–'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-6 py-4">
                    {v.status === 'active' && (
                      <button
                        onClick={() => handleCheckout(v.id)}
                        disabled={checkingOut === v.id}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
                      >
                        <LogOut size={13} />
                        {t('common.checkout')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecent.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    {search ? t('visitors.noData') : t('dashboard.noRecentVisits')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
