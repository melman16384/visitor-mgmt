import React, { useState, useEffect, useCallback } from 'react';
import { Plus, QrCode, Trash2, ZoomIn, CalendarCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import Modal from '../components/Modal';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

function PreRegForm({ onSubmit, hosts, locations, purposes, loading, defaultHostId }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    visitor_first_name: '', visitor_last_name: '', visitor_email: '',
    visitor_company: '', host_id: defaultHostId || '', location_id: '',
    expected_date: '', expected_time: '', purpose: '', notes: '',
  });
  const [hostManualName, setHostManualName] = useState('');
  const [hostError, setHostError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isManualHost = form.host_id === '_manual';

  useEffect(() => {
    if (purposes.length > 0 && !form.purpose) set('purpose', purposes[0].name);
  }, [purposes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.host_id) {
      setHostError(t('preregistrations.form.hostError'));
      return;
    }
    if (isManualHost && !hostManualName.trim()) {
      setHostError(t('preregistrations.form.hostNameError'));
      return;
    }
    setHostError('');
    onSubmit({
      ...form,
      host_id: isManualHost ? null : form.host_id,
      host_name_free: isManualHost ? hostManualName.trim() : null,
    });
  };

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.firstName')} *</label>
          <input className={inp} value={form.visitor_first_name}
            onChange={e => set('visitor_first_name', e.target.value)} required placeholder="Max" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.lastName')} *</label>
          <input className={inp} value={form.visitor_last_name}
            onChange={e => set('visitor_last_name', e.target.value)} required placeholder="Mustermann" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('preregistrations.form.email')} <span className="text-gray-400 font-normal">({t('preregistrations.form.emailHint')})</span>
          </label>
          <input type="email" className={inp} value={form.visitor_email}
            onChange={e => set('visitor_email', e.target.value)} placeholder="besucher@firma.de" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.company')}</label>
          <input className={inp} value={form.visitor_company}
            onChange={e => set('visitor_company', e.target.value)} placeholder="Firma GmbH" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.host')} *</label>
        <select className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${hostError ? 'border-red-400' : 'border-gray-300'}`}
          value={form.host_id} onChange={e => { set('host_id', e.target.value); setHostManualName(''); setHostError(''); }} required>
          <option value="">{t('common.noFilter')}</option>
          {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          <option value="_manual">{t('common.manualEntry')}</option>
        </select>
        {isManualHost && (
          <input className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mt-2 ${hostError ? 'border-red-400' : 'border-gray-300'}`}
            value={hostManualName} onChange={e => { setHostManualName(e.target.value); setHostError(''); }}
            placeholder={t('preregistrations.form.hostPlaceholder')} autoFocus />
        )}
        {hostError && <p className="mt-1 text-xs text-red-600">{hostError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.location')}</label>
          <select className={inp} value={form.location_id} onChange={e => set('location_id', e.target.value)}>
            <option value="">{t('common.selectLocation')}</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.purpose')}</label>
          <select className={inp} value={form.purpose} onChange={e => set('purpose', e.target.value)}>
            {purposes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.date')} *</label>
          <input type="date" className={inp} value={form.expected_date}
            onChange={e => set('expected_date', e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.time')}</label>
          <input type="time" className={inp} value={form.expected_time}
            onChange={e => set('expected_time', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('preregistrations.form.notes')}</label>
        <textarea rows={2} className={inp} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2">
        {loading ? t('common.loading') : <><Plus size={16} /> {t('preregistrations.form.submit')}</>}
      </button>
    </form>
  );
}

export default function PreRegistration() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [defaultHostId, setDefaultHostId] = useState('');
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);

  const DATE_FILTERS = [
    { key: 'all',      label: t('preregistrations.filters.all') },
    { key: 'today',    label: t('preregistrations.filters.today') },
    { key: 'tomorrow', label: t('preregistrations.filters.tomorrow') },
    { key: 'week',     label: t('preregistrations.filters.week') },
  ];

  const statusConfig = {
    pending:    { label: t('status.pending'),   cls: 'bg-yellow-100 text-yellow-700' },
    checked_in: { label: t('status.checkedIn'), cls: 'bg-green-100 text-green-700' },
    expired:    { label: t('status.expired'),   cls: 'bg-gray-100 text-gray-500' },
    cancelled:  { label: t('status.cancelled'), cls: 'bg-red-100 text-red-700' },
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/preregistrations', { params: { date_filter: dateFilter, status: 'pending' } });
      setItems(res.data);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, t]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    Promise.all([client.get('/hosts'), client.get('/locations'), client.get('/visit-purposes')])
      .then(([h, l, p]) => {
        setHosts(h.data);
        setLocations(l.data);
        setPurposes(p.data);
        const match = h.data.find(host => host.email === user?.email);
        if (match) setDefaultHostId(String(match.id));
      })
      .catch(() => {});
  }, [user]);

  const handleCreate = async (data) => {
    setSubmitting(true);
    try {
      await client.post('/preregistrations', data);
      showToast(t('preregistrations.created'));
      setShowModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await client.delete(`/preregistrations/${id}`);
      showToast(t('preregistrations.cancelled'));
      loadData();
    } catch {
      showToast(t('common.error'), 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`${t('preregistrations.deleteConfirm')} (${name})`)) return;
    try {
      await client.delete(`/preregistrations/${id}`);
      showToast(t('preregistrations.deleted'));
      loadData();
    } catch {
      showToast(t('common.error'), 'error');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('preregistrations.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} {t('common.entries')}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Plus size={18} /> {t('preregistrations.add')}
        </button>
      </div>

      {/* Date filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {DATE_FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setDateFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-3">{t('preregistrations.table.visitor')}</th>
              <th className="text-left px-6 py-3">{t('preregistrations.table.host')}</th>
              <th className="text-left px-6 py-3">{t('preregistrations.table.expected')}</th>
              <th className="text-left px-6 py-3">{t('preregistrations.table.purpose')}</th>
              <th className="text-left px-6 py-3">{t('preregistrations.table.status')}</th>
              <th className="text-left px-6 py-3">{t('preregistrations.table.qr')}</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-16">
                <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                <CalendarCheck size={32} className="mx-auto mb-2 opacity-30" />
                {t('preregistrations.noData')}
              </td></tr>
            ) : items.map(item => {
              const sc = statusConfig[item.status] || statusConfig.pending;
              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.visitor_first_name} {item.visitor_last_name}</p>
                      <p className="text-xs text-gray-400">{item.visitor_company || item.visitor_email || '–'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{item.host_name || '–'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <p>{item.expected_date ? format(parseISO(item.expected_date), 'dd.MM.yyyy', { locale: de }) : '–'}</p>
                    {item.expected_time && <p className="text-xs text-gray-400">{item.expected_time}</p>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{item.purpose || '–'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc.cls}`}>{sc.label}</span>
                  </td>
                  <td className="px-6 py-4">
                    {item.qr_code && (
                      <button onClick={() => setQrPreview(item.qr_code)}
                        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium">
                        <QrCode size={14} /><span>{t('preregistrations.table.qr')}</span><ZoomIn size={12} />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isAdmin ? (
                      <button
                        onClick={() => handleDelete(item.id, `${item.visitor_first_name} ${item.visitor_last_name}`)}
                        title={t('common.delete')}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    ) : item.status === 'pending' && (
                      <button onClick={() => handleCancel(item.id)}
                        title={t('preregistrations.cancelConfirm')}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={t('preregistrations.modalTitle')} onClose={() => setShowModal(false)} size="lg">
          <PreRegForm onSubmit={handleCreate} hosts={hosts} locations={locations} purposes={purposes} loading={submitting} defaultHostId={defaultHostId} />
        </Modal>
      )}

      {qrPreview && (
        <Modal title={t('preregistrations.qrTitle')} onClose={() => setQrPreview(null)} size="sm">
          <div className="text-center space-y-4">
            <img
              src={`/api/preregistrations/qr-image/${encodeURIComponent(qrPreview)}`}
              alt="QR-Code"
              className="mx-auto rounded-lg border border-gray-200"
            />
            <p className="text-xs text-gray-500 font-mono break-all">{qrPreview}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
