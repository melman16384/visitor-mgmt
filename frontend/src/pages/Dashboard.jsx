import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, UserCheck, UserMinus, Calendar, LogOut, UserPlus, Search, X, ChevronRight, Zap, ArrowLeft } from 'lucide-react';
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

function QuickCheckinPanel({ hosts, purposes, onSuccess, onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [preRegs, setPreRegs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [checkinForm, setCheckinForm] = useState({ host_id: '', purpose: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    client.get('/preregistrations?date_filter=today').then(r => {
      const list = r.data.preregistrations || r.data || [];
      setPreRegs(list.filter(p => p.status === 'pending').slice(0, 6));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (purposes.length > 0 && !checkinForm.purpose) {
      setCheckinForm(f => ({ ...f, purpose: purposes[0].name }));
    }
  }, [purposes]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await client.get(`/visitors?search=${encodeURIComponent(query)}&limit=6`);
        setResults(r.data.visitors || []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  const handleCheckin = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      let visitorId = selected.id;
      if (!visitorId) {
        // Visitor not yet in system — create via the public POST /visitors route
        const pr = selected._prereg;
        const r = await client.post('/visitors', {
          first_name: selected.first_name,
          last_name: selected.last_name,
          email: selected.email || null,
          company: selected.company || null,
          host_id: checkinForm.host_id || null,
          purpose: checkinForm.purpose || null,
          notes: checkinForm.notes || null,
        });
        showToast(t('visitors.checkedIn'));
        onSuccess();
        onClose();
        return;
      }
      await client.post(`/visitors/${visitorId}/checkin`, {
        host_id: checkinForm.host_id || null,
        purpose: checkinForm.purpose || null,
        notes: checkinForm.notes || null,
      });
      showToast(t('visitors.checkedIn'));
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectPreReg = async (prereg) => {
    let visitorId = null;
    if (prereg.visitor_email) {
      try {
        const r = await client.get(`/visitors?search=${encodeURIComponent(prereg.visitor_email)}&limit=1`);
        visitorId = r.data.visitors?.[0]?.id || null;
      } catch {}
    }
    setSelected({
      id: visitorId,
      first_name: prereg.visitor_first_name,
      last_name: prereg.visitor_last_name,
      company: prereg.visitor_company,
      email: prereg.visitor_email,
      abat_id: null,
      _prereg: prereg,
    });
    setCheckinForm({
      host_id: prereg.host_id ? String(prereg.host_id) : '',
      purpose: prereg.purpose || (purposes[0]?.name || ''),
      notes: prereg.notes || '',
    });
  };

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={14} /> Zurück zur Suche
        </button>
        <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-xl border border-primary-100">
          <InitialsAvatar name={`${selected.first_name} ${selected.last_name}`} />
          <div>
            <p className="font-semibold text-gray-900 text-sm">{selected.first_name} {selected.last_name}</p>
            <p className="text-xs text-gray-500">{selected.company || '–'}{selected.abat_id ? ` · ${selected.abat_id}` : ''}</p>
          </div>
        </div>
        <form onSubmit={handleCheckin} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.host')}</label>
            <select className={inp} value={checkinForm.host_id} onChange={e => setCheckinForm(f => ({ ...f, host_id: e.target.value }))}>
              <option value="">{t('common.selectHost')}</option>
              {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.purpose')}</label>
            <select className={inp} value={checkinForm.purpose} onChange={e => setCheckinForm(f => ({ ...f, purpose: e.target.value }))}>
              {purposes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.notes')}</label>
            <textarea rows={2} className={inp} value={checkinForm.notes} onChange={e => setCheckinForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            <Zap size={15} />
            {submitting ? t('common.loading') : 'Jetzt einchecken'}
          </button>
        </form>
      </div>
    );
  }

  const showPreRegs = query.length < 2 && preRegs.length > 0;
  const showResults = query.length >= 2;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          placeholder="Name, Firma oder abat-ID eingeben…"
          className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        )}
      </div>

      {showPreRegs && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Vorregistriert für heute</p>
          <div className="space-y-1.5">
            {preRegs.map(p => (
              <button key={p.id} onClick={() => selectPreReg(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-all text-left group">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {(p.visitor_first_name?.[0] || '') + (p.visitor_last_name?.[0] || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.visitor_first_name} {p.visitor_last_name}</p>
                  <p className="text-xs text-gray-400 truncate">{p.visitor_company || '–'} · {p.expected_time ? p.expected_time.slice(0, 5) + ' Uhr' : 'Kein Uhrzeit'} · {p.host_name || ''}</p>
                </div>
                <span className="text-xs text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  Check-in <ChevronRight size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showResults && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bekannte Besucher</p>
          {results.length === 0 && !searching ? (
            <p className="text-sm text-gray-400 text-center py-4">Kein Besucher gefunden</p>
          ) : (
            <div className="space-y-1.5">
              {results.map(v => (
                <button key={v.id} onClick={() => setSelected(v)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-all text-left group">
                  <InitialsAvatar name={`${v.first_name} ${v.last_name}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.first_name} {v.last_name}</p>
                    <p className="text-xs text-gray-400 truncate">{v.company || '–'}{v.abat_id ? ` · ${v.abat_id}` : ''}</p>
                  </div>
                  <ChevronRight size={15} className="text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!showPreRegs && !showResults && (
        <p className="text-sm text-gray-400 text-center py-6">Mindestens 2 Zeichen eingeben</p>
      )}
    </div>
  );
}

function CheckinModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('quick');
  const [hosts, setHosts] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([client.get('/hosts'), client.get('/visit-purposes')]).then(([h, p]) => {
      setHosts(h.data.filter(x => x.active));
      setPurposes(p.data.filter(x => x.active));
    });
  }, []);

  const handleNewVisitor = async (form) => {
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus size={16} className="text-primary-600" /> {t('dashboard.checkinBtn')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex border-b border-gray-100 px-6">
          <button onClick={() => setTab('quick')}
            className={`flex items-center gap-1.5 py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === 'quick' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <Zap size={14} /> Schnell-Check-in
          </button>
          <button onClick={() => setTab('new')}
            className={`flex items-center gap-1.5 py-3 px-1 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === 'new' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <UserPlus size={14} /> Neuer Besucher
          </button>
        </div>

        <div className="p-6">
          {tab === 'quick' ? (
            <QuickCheckinPanel hosts={hosts} purposes={purposes} onSuccess={onSuccess} onClose={onClose} />
          ) : (
            <VisitorCheckinForm onSubmit={handleNewVisitor} hosts={hosts} purposes={purposes} loading={submitting} />
          )}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.today')} value={stats?.todayTotal} icon={Users} color="blue" />
        <StatCard title={t('dashboard.currentlyPresent')} value={stats?.currentlyIn} icon={UserCheck} color="green" />
        <StatCard title={t('dashboard.checkedOut')} value={stats?.checkedOutToday} icon={UserMinus} color="yellow" />
        <StatCard title={t('dashboard.thisWeek')} value={stats?.thisWeekTotal} icon={Calendar} color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
