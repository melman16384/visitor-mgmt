import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function VisitorCheckinForm({ onSubmit, hosts, purposes, loading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '',
    host_id: '', purpose: '', notes: '', nda_signed: false,
  });
  const [hostManualName, setHostManualName] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isManualHost = form.host_id === '_manual';

  useEffect(() => {
    if (purposes.length > 0 && !form.purpose) set('purpose', purposes[0].name);
  }, [purposes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      host_id: isManualHost ? null : (form.host_id || null),
      host_name_free: isManualHost ? hostManualName.trim() : null,
    });
  };

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.firstName')} *</label>
          <input className={inp} value={form.first_name}
            onChange={e => set('first_name', e.target.value)} required placeholder="Max" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.lastName')} *</label>
          <input className={inp} value={form.last_name}
            onChange={e => set('last_name', e.target.value)} required placeholder="Mustermann" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.email')}</label>
          <input type="email" className={inp} value={form.email}
            onChange={e => set('email', e.target.value)} placeholder="max@firma.de" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.phone')}</label>
          <input type="tel" className={inp} value={form.phone}
            onChange={e => set('phone', e.target.value)} placeholder="+49 30 ..." />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.company')}</label>
        <input className={inp} value={form.company}
          onChange={e => set('company', e.target.value)} placeholder="Beispiel GmbH" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.host')} *</label>
        <select className={inp} value={form.host_id}
          onChange={e => { set('host_id', e.target.value); setHostManualName(''); }} required>
          <option value="">{t('common.selectHost')}</option>
          {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          <option value="_manual">{t('common.manualEntry')}</option>
        </select>
        {isManualHost && (
          <input className={`${inp} mt-2`} value={hostManualName}
            onChange={e => setHostManualName(e.target.value)}
            placeholder={t('visitors.form.hostPlaceholder')} required autoFocus />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.purpose')}</label>
        <select className={inp} value={form.purpose} onChange={e => set('purpose', e.target.value)}>
          {purposes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('visitors.form.notes')}</label>
        <textarea rows={2} className={inp} value={form.notes}
          onChange={e => set('notes', e.target.value)} />
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
          checked={form.nda_signed} onChange={e => set('nda_signed', e.target.checked)} />
        <span className="text-sm text-gray-700">{t('visitors.form.nda')}</span>
      </label>
      <button type="submit" disabled={loading}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 text-sm">
        {loading ? t('common.loading') : t('visitors.form.submit')}
      </button>
    </form>
  );
}
