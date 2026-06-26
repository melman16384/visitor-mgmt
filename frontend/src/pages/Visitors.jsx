import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, LogOut, FileText, Trash2, Users, UserCheck, UserX, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import Modal from '../components/Modal';
import DocumentSigning from '../components/DocumentSigning';
import VisitorCheckinForm from '../components/VisitorCheckinForm';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

function StatusBadge({ visitStatus }) {
  const { t } = useTranslation();
  if (visitStatus === 'active') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{t('status.active')}</span>;
  if (visitStatus === 'completed') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">{t('status.completed')}</span>;
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">–</span>;
}

function PreRegStatusBadge({ status }) {
  const { t } = useTranslation();
  const cfg = {
    pending:    { label: t('status.pending'),   cls: 'bg-yellow-100 text-yellow-700' },
    checked_in: { label: t('status.checkedIn'), cls: 'bg-green-100 text-green-700' },
    expired:    { label: t('status.expired'),   cls: 'bg-gray-100 text-gray-500' },
    cancelled:  { label: t('status.cancelled'), cls: 'bg-red-100 text-red-700' },
  };
  const c = cfg[status] || cfg.pending;
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>{c.label}</span>;
}

function InitialsAvatar({ name }) {
  const initials = name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
  const color = colors[name?.charCodeAt(0) % colors.length] || colors[0];
  return (
    <div className={`w-9 h-9 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}


export default function Visitors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [visitors, setVisitors] = useState([]);
  const [announced, setAnnounced] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hosts, setHosts] = useState([]);
  const [purposes, setPurposes] = useState([]);

  const [checkingOut, setCheckingOut] = useState(null);
  const [newVisitId, setNewVisitId] = useState(null);

  const TABS = [
    { key: 'all',       label: t('visitors.tabs.all'),      icon: Users },
    { key: 'announced', label: t('visitors.tabs.announced'), icon: CalendarClock },
    { key: 'active',    label: t('visitors.tabs.active'),   icon: UserCheck },
    { key: 'completed', label: t('visitors.tabs.left'),     icon: UserX },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'announced') {
        const res = await client.get('/preregistrations', { params: { status: 'pending' } });
        setAnnounced(res.data.items || res.data);
        setTotal((res.data.items || res.data).length);
        setPages(1);
      } else {
        const params = { search, status: activeTab, page, limit: 20 };
        const res = await client.get('/visitors', { params });
        setVisitors(res.data.visitors);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page, t]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    client.get('/hosts').then(r => setHosts(r.data)).catch(() => {});
    client.get('/visit-purposes').then(r => setPurposes(r.data)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [activeTab, search]);

  const handleCheckin = async (form) => {
    setSubmitting(true);
    try {
      const res = await client.post('/visitors', form);
      showToast(`${res.data.visitor.first_name} ${res.data.visitor.last_name} ${t('visitors.checkedIn')}`);
      if (res.data.visit?.id) {
        setNewVisitId(res.data.visit.id);
      } else {
        setShowModal(false);
      }
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleDelete = async (visitorId, name) => {
    if (!window.confirm(`${t('visitors.deleteConfirm')} (${name})`)) return;
    try {
      await client.delete(`/visitors/${visitorId}`);
      showToast(t('visitors.deleted'));
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || t('common.error'), 'error');
    }
  };

  const handleBadge = (visitorId, visitId) => {
    window.open(`/api/visitors/${visitorId}/badge/${visitId}`, '_blank');
  };

  const fmtDate = (d) => d ? format(new Date(d), 'dd.MM.yy HH:mm', { locale: de }) : '–';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('visitors.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} {activeTab === 'announced' ? t('visitors.tabs.announced') : t('visitors.title')}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Plus size={18} /> {t('visitors.add')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
              ${activeTab === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Search — only for non-announced tabs */}
      {activeTab !== 'announced' && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('visitors.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'announced' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-6 py-3">{t('visitors.table.visitor')}</th>
                  <th className="text-left px-6 py-3">{t('visitors.table.host')}</th>
                  <th className="text-left px-6 py-3">{t('preregistrations.table.expected')}</th>
                  <th className="text-left px-6 py-3">{t('common.purpose')}</th>
                  <th className="text-left px-6 py-3">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16">
                    <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  </td></tr>
                ) : announced.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400">{t('visitors.noData')}</td></tr>
                ) : announced.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={`${a.visitor_first_name} ${a.visitor_last_name}`} />
                        <div>
                          <p className="font-medium text-gray-900">{a.visitor_first_name} {a.visitor_last_name}</p>
                          <p className="text-xs text-gray-400">{a.visitor_company || '–'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{a.host_name || '–'}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {a.expected_date ? format(parseISO(a.expected_date), 'dd.MM.yyyy', { locale: de }) : '–'}
                      {a.expected_time ? ` ${a.expected_time.slice(0, 5)}` : ''}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{a.purpose || '–'}</td>
                    <td className="px-6 py-4"><PreRegStatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-6 py-3">{t('visitors.table.visitor')}</th>
                  <th className="text-left px-6 py-3">{t('visitors.table.abatId')}</th>
                  <th className="text-left px-6 py-3">{t('visitors.table.host')}</th>
                  <th className="text-left px-6 py-3">{t('common.status')}</th>
                  <th className="text-left px-6 py-3">
                    {activeTab === 'completed' ? t('visitors.table.checkedOut') : t('visitors.table.checkedIn')}
                  </th>
                  <th className="text-left px-6 py-3">{t('visitors.table.badge')}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-16">
                    <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  </td></tr>
                ) : visitors.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400">{t('visitors.noData')}</td></tr>
                ) : visitors.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={`${v.first_name} ${v.last_name}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{v.first_name} {v.last_name}</p>
                            {v.nda_signed ? <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">NDA</span> : null}
                          </div>
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
                    <td className="px-6 py-4">
                      <StatusBadge visitStatus={v.visit_status} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {activeTab === 'completed'
                        ? fmtDate(v.checked_out_at)
                        : fmtDate(v.checked_in_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{v.badge_number || '–'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        {v.visit_id && v.visit_status === 'active' && (
                          <button onClick={() => handleBadge(v.id, v.visit_id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('visitors.printBadge')}>
                            <FileText size={15} />
                          </button>
                        )}
                        {v.visit_status === 'active' && v.visit_id && (
                          <button onClick={() => handleCheckout(v.visit_id)} disabled={checkingOut === v.visit_id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title={t('visitors.checkout')}>
                            <LogOut size={15} />
                          </button>
                        )}
                        {user?.role === 'superadmin' && v.visit_status !== 'active' && (
                          <button onClick={() => handleDelete(v.id, `${v.first_name} ${v.last_name}`)}
                            className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title={t('common.delete')}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && activeTab !== 'announced' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">{page} / {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 transition-colors">
                ‹
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 transition-colors">
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New visitor modal */}
      {showModal && !newVisitId && (
        <Modal title={t('visitors.add')} onClose={() => setShowModal(false)} size="lg">
          <VisitorCheckinForm onSubmit={handleCheckin} hosts={hosts} purposes={purposes} loading={submitting} />
        </Modal>
      )}

      {/* Document signing modal */}
      {showModal && newVisitId && (
        <Modal title="Dokument unterschreiben" onClose={() => { setShowModal(false); setNewVisitId(null); }} size="lg">
          <div className="space-y-4">
            <p className="text-sm text-abat-dunkelgrau">Der Besucher wurde eingecheckt. Möchten Sie jetzt ein Dokument hochladen und unterschreiben lassen?</p>
            <DocumentSigning
              visitId={newVisitId}
              onComplete={() => { setShowModal(false); setNewVisitId(null); showToast('Dokument erfolgreich gespeichert'); }}
            />
            <button onClick={() => { setShowModal(false); setNewVisitId(null); }}
              className="w-full border-2 border-abat-hellgrau text-abat-dunkelgrau py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm">
              {t('common.back')}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
