import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { LogOut, CalendarPlus, CheckCircle2, Clock, CalendarClock, ChevronDown, ChevronUp, KeyRound, Building2, User } from 'lucide-react';

function hostClient() {
  const token = localStorage.getItem('host_token');
  return axios.create({
    baseURL: '/api/host-portal',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function fmt(ts) {
  if (!ts) return '–';
  try {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ts; }
}

function fmtDate(s) {
  if (!s) return '–';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

function VisitorCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, iconClass, title, count, expanded, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-gray-200"
    >
      <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
        <Icon size={16} className={iconClass} />
        {title}
        <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">{count}</span>
      </div>
      {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
    </button>
  );
}

export default function HostPortal() {
  const { t } = useTranslation();
  const [host, setHost] = useState(null);
  const [activeTab, setActiveTab] = useState('visitors');
  const [visitors, setVisitors] = useState({ upcoming: [], active: [], completed: [] });
  const [purposes, setPurposes] = useState([]);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [expandUpcoming, setExpandUpcoming] = useState(true);
  const [expandActive, setExpandActive] = useState(true);
  const [expandCompleted, setExpandCompleted] = useState(false);
  const [form, setForm] = useState({
    visitor_first_name: '', visitor_last_name: '', visitor_email: '',
    visitor_company: '', expected_date: '', expected_time: '',
    purpose: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const navigate = useNavigate();

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const token = localStorage.getItem('host_token');
    if (!token) { navigate('/host/login'); return; }
    hostClient().get('/me')
      .then(r => setHost(r.data.host))
      .catch(() => { localStorage.removeItem('host_token'); navigate('/host/login'); });
  }, [navigate]);

  const loadVisitors = useCallback(() => {
    setLoadingVisitors(true);
    hostClient().get('/visitors')
      .then(r => setVisitors(r.data))
      .catch(console.error)
      .finally(() => setLoadingVisitors(false));
  }, []);

  useEffect(() => {
    if (!host) return;
    loadVisitors();
    axios.get('/api/visit-purposes').then(r => setPurposes(r.data)).catch(() => {});
    const interval = setInterval(loadVisitors, 30000);
    return () => clearInterval(interval);
  }, [host, loadVisitors]);

  const handleLogout = () => {
    localStorage.removeItem('host_token');
    navigate('/host/login');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.new_password !== pwForm.confirm_password)
      return setPwError(t('hostPortal.pw.mismatch'));
    setPwSubmitting(true);
    try {
      await hostClient().put('/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwSuccess(t('hostPortal.pw.success'));
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwError(err.response?.data?.error || t('hostPortal.pw.error'));
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await hostClient().post('/preregistrations', form);
      setSuccessMsg(t('hostPortal.form.success') || 'Vorregistrierung gespeichert.');
      setForm({
        visitor_first_name: '', visitor_last_name: '', visitor_email: '',
        visitor_company: '', expected_date: '', expected_time: '', purpose: '', notes: '',
      });
      await loadVisitors();
    } catch (err) {
      setFormError(err.response?.data?.error || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!host) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  const TABS = [
    { key: 'visitors', label: t('hostPortal.tabs.visitors'), icon: CalendarClock },
    { key: 'prereg', label: t('hostPortal.tabs.preregistration'), icon: CalendarPlus },
    { key: 'password', label: t('hostPortal.tabs.password'), icon: KeyRound },
  ];

  return (
    <div className="min-h-screen bg-gray-100 pb-20 sm:pb-0">
      {/* Header */}
      <header className="bg-abat-dunkelgrau text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-light.png" alt="abat AG" className="h-7" />
            <div>
              <p className="text-xs text-abat-hellgrau leading-none">{t('hostPortal.header')}</p>
              <p className="font-semibold text-sm leading-tight">{host.name}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="hidden sm:flex items-center gap-2 text-abat-hellgrau hover:text-white transition-colors text-sm">
            <LogOut size={16} /> {t('hostPortal.logout')}
          </button>
          <button onClick={handleLogout} className="sm:hidden text-abat-hellgrau hover:text-white">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Desktop tabs */}
      <div className="hidden sm:block max-w-3xl mx-auto px-4 pt-4">
        <div className="flex gap-1 border-b border-gray-200 bg-white rounded-t-xl px-4">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === key ? 'border-abat-blau text-abat-blau' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* ── Visitors tab ─────────────────────────────────────────────── */}
        {activeTab === 'visitors' && (
          <div className="space-y-3">

            {/* Upcoming */}
            <div>
              <SectionHeader
                icon={CalendarClock} iconClass="text-blue-500"
                title={t('hostPortal.sections.upcoming')} count={visitors.upcoming.length}
                expanded={expandUpcoming} onToggle={() => setExpandUpcoming(v => !v)}
              />
              {expandUpcoming && (
                <div className="mt-2 space-y-2">
                  {loadingVisitors ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    </div>
                  ) : visitors.upcoming.length === 0 ? (
                    <p className="text-center py-6 text-sm text-gray-400">{t('hostPortal.noUpcoming')}</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="sm:hidden space-y-2">
                        {visitors.upcoming.map(p => (
                          <VisitorCard key={p.id}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{p.visitor_first_name} {p.visitor_last_name}</p>
                                {p.visitor_company && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Building2 size={11} />{p.visitor_company}</p>}
                              </div>
                              <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {fmtDate(p.expected_date)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                              {p.expected_time && <span>{p.expected_time.slice(0, 5)} Uhr</span>}
                              {p.purpose && <span>{p.purpose}</span>}
                            </div>
                          </VisitorCard>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                            <tr>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.name')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.company')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.expected')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.time')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.purpose')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {visitors.upcoming.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">{p.visitor_first_name} {p.visitor_last_name}</td>
                                <td className="px-5 py-3 text-gray-600">{p.visitor_company || '–'}</td>
                                <td className="px-5 py-3 text-gray-600">{fmtDate(p.expected_date)}</td>
                                <td className="px-5 py-3 text-gray-500">{p.expected_time ? p.expected_time.slice(0, 5) + ' Uhr' : '–'}</td>
                                <td className="px-5 py-3 text-gray-500">{p.purpose || '–'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Active */}
            <div>
              <SectionHeader
                icon={CheckCircle2} iconClass="text-green-500"
                title={t('hostPortal.sections.active')} count={visitors.active.length}
                expanded={expandActive} onToggle={() => setExpandActive(v => !v)}
              />
              {expandActive && (
                <div className="mt-2 space-y-2">
                  {loadingVisitors ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    </div>
                  ) : visitors.active.length === 0 ? (
                    <p className="text-center py-6 text-sm text-gray-400">{t('hostPortal.noActive')}</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="sm:hidden space-y-2">
                        {visitors.active.map(v => (
                          <VisitorCard key={v.id}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{v.first_name} {v.last_name}</p>
                                {v.company && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Building2 size={11} />{v.company}</p>}
                              </div>
                              <span className="text-xs text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">{t('hostPortal.present')}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                              {v.abat_id && <span className="font-mono">{v.abat_id}</span>}
                              <span>seit {fmt(v.checked_in_at).slice(12)}</span>
                            </div>
                          </VisitorCard>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                            <tr>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.name')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.company')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.abatId')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.checkedIn')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {visitors.active.map(v => (
                              <tr key={v.id} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">{v.first_name} {v.last_name}</td>
                                <td className="px-5 py-3 text-gray-600">{v.company || '–'}</td>
                                <td className="px-5 py-3 font-mono text-xs text-gray-500">{v.abat_id || '–'}</td>
                                <td className="px-5 py-3 text-gray-500">{fmt(v.checked_in_at)}</td>
                                <td className="px-5 py-3">
                                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{t('hostPortal.present')}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Completed */}
            <div>
              <SectionHeader
                icon={Clock} iconClass="text-gray-400"
                title={t('hostPortal.sections.completed')} count={visitors.completed.length}
                expanded={expandCompleted} onToggle={() => setExpandCompleted(v => !v)}
              />
              {expandCompleted && (
                <div className="mt-2 space-y-2">
                  {loadingVisitors ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    </div>
                  ) : visitors.completed.length === 0 ? (
                    <p className="text-center py-6 text-sm text-gray-400">{t('hostPortal.noCompleted')}</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="sm:hidden space-y-2">
                        {visitors.completed.map(v => (
                          <VisitorCard key={v.id}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{v.first_name} {v.last_name}</p>
                                {v.company && <p className="text-xs text-gray-500">{v.company}</p>}
                              </div>
                              <span className="text-xs text-gray-500 font-mono">{v.abat_id || ''}</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-400 flex gap-3">
                              <span>ein: {fmt(v.checked_in_at).slice(0, 10)}</span>
                              <span>aus: {fmt(v.checked_out_at).slice(0, 10)}</span>
                            </div>
                          </VisitorCard>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                            <tr>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.name')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.company')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.abatId')}</th>
                              <th className="text-left px-5 py-3">{t('hostPortal.table.checkedIn')}</th>
                              <th className="text-left px-5 py-3">{t('visitors.table.checkedOut')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {visitors.completed.map(v => (
                              <tr key={v.id} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">{v.first_name} {v.last_name}</td>
                                <td className="px-5 py-3 text-gray-600">{v.company || '–'}</td>
                                <td className="px-5 py-3 font-mono text-xs text-gray-500">{v.abat_id || '–'}</td>
                                <td className="px-5 py-3 text-gray-500">{fmt(v.checked_in_at)}</td>
                                <td className="px-5 py-3 text-gray-500">{fmt(v.checked_out_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Preregistration tab ───────────────────────────────────────── */}
        {activeTab === 'prereg' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-1">{t('hostPortal.form.title')}</h2>
            <p className="text-sm text-gray-500 mb-5">{t('hostPortal.form.subtitle')}</p>

            {successMsg && (
              <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.firstName')} *</label>
                  <input className={inp} value={form.visitor_first_name}
                    onChange={e => setF('visitor_first_name', e.target.value)} required placeholder="Max" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.lastName')} *</label>
                  <input className={inp} value={form.visitor_last_name}
                    onChange={e => setF('visitor_last_name', e.target.value)} required placeholder="Mustermann" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.email')} <span className="text-gray-400 font-normal">({t('hostPortal.form.emailHint')})</span></label>
                  <input type="email" className={inp} value={form.visitor_email}
                    onChange={e => setF('visitor_email', e.target.value)} placeholder="besucher@firma.de" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.company')}</label>
                  <input className={inp} value={form.visitor_company}
                    onChange={e => setF('visitor_company', e.target.value)} placeholder="Firma GmbH" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.date')} *</label>
                  <input type="date" className={inp} value={form.expected_date}
                    onChange={e => setF('expected_date', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.time')}</label>
                  <input type="time" className={inp} value={form.expected_time}
                    onChange={e => setF('expected_time', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.purpose')}</label>
                {purposes.length > 0 ? (
                  <select className={inp} value={form.purpose} onChange={e => setF('purpose', e.target.value)}>
                    <option value="">{t('hostPortal.form.purposePlaceholder')}</option>
                    {purposes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                ) : (
                  <input className={inp} value={form.purpose}
                    onChange={e => setF('purpose', e.target.value)} placeholder={t('hostPortal.form.purposeInput')} />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.form.notes')}</label>
                <textarea className={`${inp} resize-none`} rows={3} value={form.notes}
                  onChange={e => setF('notes', e.target.value)} placeholder={t('hostPortal.form.notesPlaceholder')} />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-abat-blau hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors text-sm">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('common.loading')}
                  </span>
                ) : t('hostPortal.form.submit')}
              </button>
            </form>
          </div>
        )}

        {/* ── Password tab ─────────────────────────────────────────────── */}
        {activeTab === 'password' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-1">{t('hostPortal.pw.title')}</h2>
            <p className="text-sm text-gray-500 mb-5">{t('hostPortal.pw.subtitle')}</p>

            {pwSuccess && (
              <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                <span>{pwSuccess}</span>
              </div>
            )}
            {pwError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{pwError}</div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.pw.current')} *</label>
                <input type="password" className={inp} value={pwForm.current_password}
                  onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.pw.new')} *</label>
                <input type="password" className={inp} value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required minLength={8} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hostPortal.pw.confirm')} *</label>
                <input type="password" className={inp} value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} required />
              </div>
              <button type="submit" disabled={pwSubmitting}
                className="w-full bg-abat-blau hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors text-sm">
                {pwSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('common.loading')}
                  </span>
                ) : t('hostPortal.pw.submit')}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 flex">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeTab === key ? 'text-abat-blau' : 'text-gray-400'
            }`}>
            <Icon size={20} strokeWidth={activeTab === key ? 2.5 : 1.5} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
