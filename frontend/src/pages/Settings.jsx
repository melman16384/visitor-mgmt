import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, MapPin, Mail, Key, Save, Check, ListChecks, Users, ShieldCheck, Eye, EyeOff, Clock, GripVertical, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function LocationsTab() {
  const { t } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', city: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const res = await client.get('/locations');
    setLocations(res.data);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ name: '', address: '', city: '' }); setModal('add'); };
  const openEdit = (l) => { setForm(l); setModal('edit'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (modal === 'add') await client.post('/locations', form);
      else await client.put(`/locations/${form.id}`, form);
      showToast(modal === 'add' ? t('settings.locations.added') : t('settings.locations.updated'));
      setModal(null);
      load();
    } catch { showToast(t('common.error'), 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/locations/${id}`);
      showToast(t('settings.locations.deactivated'));
      load();
    } catch { showToast(t('common.error'), 'error'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{locations.length} {t('settings.tabs.locations')}</p>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> {t('settings.locations.add')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">{t('settings.locations.name')}</th>
              <th className="text-left px-5 py-3">{t('settings.locations.address')}</th>
              <th className="text-left px-5 py-3">{t('settings.locations.city')}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {locations.map(l => (
              <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-primary-500" />
                    <span className="font-medium text-gray-900">{l.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-600">{l.address || '–'}</td>
                <td className="px-5 py-4 text-gray-600">{l.city || '–'}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(l)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(l.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'add' ? t('settings.locations.addTitle') : t('settings.locations.editTitle')}
          onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.locations.name')} *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.locations.address')}</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.locations.city')}</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function PurposesTab() {
  const { t } = useTranslation();
  const [purposes, setPurposes] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '' });
  const [submitting, setSubmitting] = useState(false);
  const dragId = useRef(null);
  const dragOverId = useRef(null);

  const load = async () => {
    const res = await client.get('/visit-purposes');
    setPurposes(res.data);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ name: '' }); setModal('add'); };
  const openEdit = (p) => { setForm(p); setModal('edit'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (modal === 'add') await client.post('/visit-purposes', form);
      else await client.put(`/visit-purposes/${form.id}`, form);
      showToast(modal === 'add' ? t('settings.purposes.added') : t('settings.purposes.updated'));
      setModal(null);
      load();
    } catch { showToast(t('common.error'), 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/visit-purposes/${id}`);
      showToast(t('settings.purposes.deactivated'));
      load();
    } catch { showToast(t('common.error'), 'error'); }
  };

  const handleDragStart = (id) => { dragId.current = id; };
  const handleDragOver = (e, id) => { e.preventDefault(); dragOverId.current = id; };

  const handleDrop = async () => {
    const from = dragId.current;
    const to = dragOverId.current;
    if (!from || !to || from === to) return;

    const reordered = [...purposes];
    const fromIdx = reordered.findIndex(p => p.id === from);
    const toIdx = reordered.findIndex(p => p.id === to);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const withOrder = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setPurposes(withOrder);
    dragId.current = null;
    dragOverId.current = null;

    try {
      await client.put('/visit-purposes/reorder', {
        order: withOrder.map(p => ({ id: p.id, sort_order: p.sort_order })),
      });
    } catch { showToast(t('common.error'), 'error'); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{purposes.length} {t('settings.tabs.purposes')} · {t('settings.purposes.dragHint')}</p>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> {t('settings.purposes.add')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="w-8 px-3 py-3"></th>
              <th className="text-left px-3 py-3">{t('settings.purposes.name')}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {purposes.map(p => (
              <tr key={p.id}
                draggable
                onDragStart={() => handleDragStart(p.id)}
                onDragOver={e => handleDragOver(e, p.id)}
                onDrop={handleDrop}
                className="hover:bg-gray-50 transition-colors cursor-default">
                <td className="pl-3 py-4">
                  <GripVertical size={16} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing" />
                </td>
                <td className="px-3 py-4 font-medium text-gray-900">{p.name}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'add' ? t('settings.purposes.addTitle') : t('settings.purposes.editTitle')}
          onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.purposes.name')} *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const ROLE_LABELS = { superadmin: t('roles.superadmin'), admin: t('roles.admin'), receptionist: t('roles.receptionist') };
  const [users, setUsers] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'receptionist', location_ids: [], active: true });
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [resetPw, setResetPw] = useState({ userId: null, password: '' });
  const { user: currentUser } = useAuth();

  const load = async () => {
    const [ur, lr] = await Promise.all([client.get('/users'), client.get('/locations')]);
    setUsers(ur.data);
    setAllLocations(lr.data);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ name: '', email: '', password: '', role: 'receptionist', location_ids: [], active: true }); setShowPw(false); setModal('add'); };
  const openEdit = (u) => { setForm({ ...u, location_ids: u.location_ids || [], password: '' }); setShowPw(false); setModal('edit'); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      if (modal === 'add') await client.post('/users', form);
      else await client.put(`/users/${form.id}`, form);
      showToast(modal === 'add' ? t('settings.users.created') : t('settings.users.updated'));
      setModal(null); load();
    } catch (err) { showToast(err.response?.data?.error || t('common.error'), 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async (id) => {
    try { await client.delete(`/users/${id}`); showToast(t('settings.users.deactivated')); load(); }
    catch (err) { showToast(err.response?.data?.error || t('common.error'), 'error'); }
  };

  const handleUnlock = async (id) => {
    try { await client.post(`/users/${id}/unlock`); showToast('Account entsperrt'); load(); }
    catch { showToast(t('common.error'), 'error'); }
  };

  const isLocked = (u) => u.locked_until && new Date(u.locked_until + 'Z') > new Date();

  const handleResetPassword = async () => {
    if (!resetPw.password || resetPw.password.length < 8) { showToast(t('common.error'), 'error'); return; }
    try { await client.post(`/users/${resetPw.userId}/reset-password`, { password: resetPw.password }); showToast(t('settings.users.passwordReset')); setResetPw({ userId: null, password: '' }); }
    catch { showToast(t('common.error'), 'error'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} {t('settings.tabs.users')}</p>
        <button onClick={openAdd} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> {t('settings.users.add')}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">{t('settings.users.name')}</th>
              <th className="text-left px-5 py-3">{t('settings.users.email')}</th>
              <th className="text-left px-5 py-3">{t('common.role')}</th>
              <th className="text-left px-5 py-3">{t('settings.users.locations')}</th>
              <th className="text-left px-5 py-3">{t('common.status')}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 font-medium text-gray-900">{u.name}</td>
                <td className="px-5 py-4 text-gray-600">{u.email}</td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {(u.location_ids || []).length === 0 ? (
                    <span className="text-xs text-gray-400">{t('common.all')}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(u.location_ids || []).map(lid => {
                        const loc = allLocations.find(l => l.id === lid);
                        return loc ? (
                          <span key={lid} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{loc.name}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4">
                  {isLocked(u) ? (
                    <span className="text-red-600 text-xs font-semibold">Gesperrt</span>
                  ) : u.active ? (
                    <span className="text-green-600 text-xs font-semibold">{t('common.active')}</span>
                  ) : (
                    <span className="text-gray-400 text-xs font-semibold">{t('common.inactive')}</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => setResetPw({ userId: u.id, password: '' })} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Passwort zurücksetzen"><Key size={14} /></button>
                    {isLocked(u) && (
                      <button onClick={() => handleUnlock(u.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Account entsperren"><RefreshCw size={14} /></button>
                    )}
                    {u.id !== currentUser?.id && u.active && (
                      <button onClick={() => handleDeactivate(u.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'add' ? t('settings.users.addTitle') : t('settings.users.editTitle')} onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[{ k: 'name', l: t('settings.users.name') }, { k: 'email', l: t('settings.users.email'), t: 'email' }].map(({ k, l, t: type }) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l} *</label>
                <input type={type || 'text'} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} required />
              </div>
            ))}
            {modal === 'add' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.users.password')} * ({t('settings.users.passwordHint')})</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.users.role')}</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, location_ids: [] }))}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.users.locations')}
              </label>
              {allLocations.length === 0 ? (
                <p className="text-xs text-gray-400">{t('settings.locations.noData')}</p>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                  {allLocations.filter(l => l.active).map(loc => (
                    <label key={loc.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded"
                        checked={(form.location_ids || []).includes(loc.id)}
                        onChange={e => setForm(f => ({
                          ...f,
                          location_ids: e.target.checked
                            ? [...(f.location_ids || []), loc.id]
                            : (f.location_ids || []).filter(id => id !== loc.id)
                        }))}
                      />
                      <span className="text-sm text-gray-700">{loc.name}</span>
                      {loc.city && <span className="text-xs text-gray-400">{loc.city}</span>}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {(form.location_ids || []).length === 0 ? t('settings.users.noLocationFilter') : ''}
              </p>
            </div>
            {modal === 'edit' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 text-primary-600 rounded" />
                <span className="text-sm text-gray-700">{t('settings.users.active')}</span>
              </label>
            )}
            <button type="submit" disabled={submitting} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </form>
        </Modal>
      )}

      {resetPw.userId && (
        <Modal title={t('settings.users.resetPwTitle')} onClose={() => setResetPw({ userId: null, password: '' })} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.users.newPw')}</label>
              <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={resetPw.password} onChange={e => setResetPw(r => ({ ...r, password: e.target.value }))} autoFocus />
            </div>
            <button onClick={handleResetPassword} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
              {t('settings.users.resetPw')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AutoCheckoutTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({ auto_checkout_enabled: 'true', auto_checkout_time: '19:00' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get('/settings/system').then(r => {
      setSettings(s => ({
        ...s,
        auto_checkout_enabled: r.data.auto_checkout_enabled ?? 'true',
        auto_checkout_time: r.data.auto_checkout_time ?? '19:00',
      }));
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put('/settings/system', settings);
      showToast(t('settings.autoCheckout.saved'));
    } catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-12 text-center text-gray-400">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('settings.autoCheckout.title')}</h3>
        <p className="text-xs text-gray-500">{t('settings.autoCheckout.description')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{t('settings.autoCheckout.enable')}</p>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, auto_checkout_enabled: s.auto_checkout_enabled === 'true' ? 'false' : 'true' }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.auto_checkout_enabled === 'true' ? 'bg-primary-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.auto_checkout_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <Clock size={14} className="inline mr-1.5 text-gray-400" />
            {t('settings.autoCheckout.timeLabel')}
          </label>
          <input
            type="time"
            value={settings.auto_checkout_time}
            onChange={e => setSettings(s => ({ ...s, auto_checkout_time: e.target.value }))}
            disabled={settings.auto_checkout_enabled !== 'true'}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Standard: 19:00 Uhr</p>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
        <Save size={15} />
        {saving ? t('common.loading') : t('settings.autoCheckout.save')}
      </button>
    </div>
  );
}

function GdprTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    gdpr_retention_days: '365', visitor_email_confirmation: 'true',
    privacy_policy_text: '', privacy_policy_enabled: 'true',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    client.get('/settings/system').then(r => { setSettings(s => ({ ...s, ...r.data })); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await client.put('/settings/system', settings); setSettings(r.data); showToast(t('settings.gdpr.saved')); }
    catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleCleanup = async () => {
    if (!window.confirm(t('settings.gdpr.cleanupConfirm'))) return;
    setCleaning(true);
    try { const r = await client.post('/settings/gdpr/cleanup'); setLastResult(r.data); showToast(t('settings.gdpr.cleanupDone')); }
    catch { showToast(t('common.error'), 'error'); }
    finally { setCleaning(false); }
  };

  if (loading) return <div className="text-gray-400 text-sm">{t('common.loading')}</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-lg">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        Persönliche Besucherdaten (Name, E-Mail, Telefon) werden nach der eingestellten Frist automatisch anonymisiert. Besuchsstatistiken bleiben erhalten.
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.gdpr.retention')}</label>
        <input type="number" min="1" max="3650"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={settings.gdpr_retention_days}
          onChange={e => setSettings(s => ({ ...s, gdpr_retention_days: e.target.value }))} />
        <p className="text-xs text-gray-400 mt-1">Standard: 365 Tage (1 Jahr)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.gdpr.emailConfirm')}</label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
            checked={settings.visitor_email_confirmation === 'true'}
            onChange={e => setSettings(s => ({ ...s, visitor_email_confirmation: e.target.checked ? 'true' : 'false' }))} />
          <span className="text-sm text-gray-700">Check-in Bestätigungs-E-Mail an Besucher senden (sofern E-Mail-Adresse vorhanden)</span>
        </label>
      </div>

      <hr className="border-gray-100" />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-gray-400" /> Datenschutzerklärung (Kiosk)
        </h3>
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
            checked={settings.privacy_policy_enabled === 'true'}
            onChange={e => setSettings(s => ({ ...s, privacy_policy_enabled: e.target.checked ? 'true' : 'false' }))} />
          <span className="text-sm text-gray-700">Datenschutzerklärung beim Kiosk-Check-in einblenden und Unterschrift verlangen</span>
        </label>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.gdpr.privacyText')}</label>
        <textarea
          rows={10}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono resize-y"
          value={settings.privacy_policy_text || ''}
          onChange={e => setSettings(s => ({ ...s, privacy_policy_text: e.target.value }))}
          placeholder="Text der Datenschutzerklärung hier einfügen…"
        />
        <p className="text-xs text-gray-400 mt-1">Der Text wird dem Besucher am Kiosk-Tablet angezeigt und muss mit einer Unterschrift bestätigt werden.</p>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className={`flex items-center gap-2 ${saving ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'} text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm`}>
          <Save size={16} /> {saving ? t('common.loading') : t('settings.gdpr.save')}
        </button>
        <button type="button" onClick={handleCleanup} disabled={cleaning}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm">
          <ShieldCheck size={16} /> {cleaning ? t('common.loading') : t('settings.gdpr.cleanup')}
        </button>
      </div>

      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          Bereinigung abgeschlossen: <strong>{lastResult.anonymized}</strong> Einträge anonymisiert (älter als {lastResult.retention_days} Tage).
        </div>
      )}
    </form>
  );
}

const SECURITY_OPTIONS = [
  { value: 'starttls', label: 'STARTTLS', desc: 'Port 587 — Standard (Gmail, Office 365)', port: '587' },
  { value: 'ssl',      label: 'SSL / TLS', desc: 'Port 465 — Direktes SSL', port: '465' },
  { value: 'none',     label: 'Keine',    desc: 'Port 25 — Interne Mailserver', port: '25' },
];

function EmailTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const EMPTY = { smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', from_email: '', from_name: '', smtp_security: 'starttls' };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    client.get('/settings/smtp-config').then(r => {
      setForm({
        smtp_host:     r.data.smtp_host     || '',
        smtp_port:     r.data.smtp_port     || '',
        smtp_user:     r.data.smtp_user     || '',
        smtp_pass:     r.data.smtp_pass     || '',
        from_email:    r.data.from_email    || '',
        from_name:     r.data.from_name     || '',
        smtp_security: r.data.smtp_security || 'starttls',
      });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await client.put('/settings/smtp-config', form);
      setForm(f => ({ ...f, smtp_pass: r.data.smtp_pass || '' }));
      showToast(t('settings.email.saved'));
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) { showToast(t('common.error'), 'error'); return; }
    setTesting(true);
    try {
      const res = await client.post('/settings/email-test', { to: testEmail });
      showToast(res.data.message);
    } catch (err) {
      showToast(err.response?.data?.error || t('settings.email.testError'), 'error');
    } finally {
      setTesting(false);
    }
  };

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all';
  const inpRO = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 font-mono';

  return (
    <div className="space-y-6 max-w-lg">

      {/* SMTP server */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">SMTP-Server</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Host</label>
            {isSuperadmin
              ? <input className={inp} value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.gmail.com" />
              : <div className={inpRO}>{form.smtp_host || <span className="italic text-gray-400">–</span>}</div>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
            {isSuperadmin
              ? <input className={inp} value={form.smtp_port} onChange={e => set('smtp_port', e.target.value)} placeholder="587" />
              : <div className={inpRO}>{form.smtp_port || '–'}</div>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Benutzername</label>
          {isSuperadmin
            ? <input className={inp} value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} placeholder="user@firma.de" autoComplete="off" />
            : <div className={inpRO}>{form.smtp_user || <span className="italic text-gray-400">–</span>}</div>}
        </div>

        {isSuperadmin && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Passwort</label>
            <input className={inp} type="password" value={form.smtp_pass}
              onChange={e => set('smtp_pass', e.target.value)}
              placeholder="Leer lassen um bestehendes zu behalten" autoComplete="new-password" />
            <p className="text-xs text-gray-400 mt-1">Leer lassen = bestehendes Passwort bleibt erhalten</p>
          </div>
        )}
      </div>

      <hr className="border-gray-100" />

      {/* Verschlüsselung */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Verschlüsselung</h3>
        <div className="space-y-2">
          {SECURITY_OPTIONS.map(opt => (
            <label key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                isSuperadmin ? 'cursor-pointer' : 'cursor-default'
              } ${
                form.smtp_security === opt.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white'
              }`}>
              <input type="radio" name="smtp_security" value={opt.value}
                checked={form.smtp_security === opt.value}
                onChange={() => isSuperadmin && set('smtp_security', opt.value)}
                disabled={!isSuperadmin}
                className="mt-0.5 text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{opt.label}
                  <span className="ml-2 font-mono text-xs text-gray-400">:{opt.port}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Absender */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Absender</h3>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Absender-E-Mail</label>
          {isSuperadmin
            ? <input className={inp} value={form.from_email} onChange={e => set('from_email', e.target.value)} placeholder="noreply@firma.de" />
            : <div className={inpRO}>{form.from_email || <span className="italic text-gray-400">–</span>}</div>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Absendername <span className="text-gray-400">(wird im E-Mail-Client angezeigt)</span></label>
          {isSuperadmin
            ? <input className={inp} value={form.from_name} onChange={e => set('from_name', e.target.value)} placeholder="Besucherverwaltung Meine Firma" />
            : <div className={inpRO}>{form.from_name || <span className="italic text-gray-400">–</span>}</div>}
          <p className="text-xs text-gray-400 mt-1">Beispiel: <span className="font-mono">Besucherverwaltung Meine Firma &lt;noreply@firma.de&gt;</span></p>
        </div>
      </div>

      {isSuperadmin && (
        <>
          <hr className="border-gray-100" />
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
            {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Speichert…</> : 'Einstellungen speichern'}
          </button>
        </>
      )}

      <hr className="border-gray-100" />

      {/* Test email */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Mail size={15} className="text-gray-400" /> Test-E-Mail senden
        </h3>
        <p className="text-xs text-gray-400">Prüft die SMTP-Verbindung und sendet eine Test-E-Mail.</p>
        <div className="flex gap-2">
          <input type="email" placeholder="Empfänger-E-Mail"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={testEmail} onChange={e => setTestEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()} />
          <button onClick={handleTest} disabled={testing || !testEmail}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap">
            <Mail size={15} className={testing ? 'animate-pulse' : ''} />
            {testing ? t('common.loading') : t('settings.email.test')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(true);
  const [savingDemo, setSavingDemo] = useState(false);

  useEffect(() => {
    if (!['superadmin', 'admin'].includes(user?.role)) return;
    client.get('/settings/system').then(r => {
      setShowDemo(r.data.show_demo_credentials !== 'false');
    }).catch(() => {});
  }, [user]);

  const handleDemoToggle = async () => {
    const next = !showDemo;
    setShowDemo(next);
    setSavingDemo(true);
    try {
      await client.put('/settings/system', { show_demo_credentials: next ? 'true' : 'false' });
      showToast(next ? 'Demo-Zugangsdaten eingeblendet' : 'Demo-Zugangsdaten ausgeblendet');
    } catch {
      setShowDemo(!next);
      showToast(t('common.error'), 'error');
    } finally {
      setSavingDemo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError(t('settings.password.mismatch'));
      return;
    }
    if (form.newPassword.length < 8) {
      setError(t('settings.password.error'));
      return;
    }
    setLoading(true);
    try {
      await client.put('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      showToast(t('settings.password.success'));
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || t('settings.password.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}
        {[
          { key: 'currentPassword', label: t('settings.password.current') },
          { key: 'newPassword', label: t('settings.password.new') },
          { key: 'confirmPassword', label: t('settings.password.confirm') },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required />
          </div>
        ))}
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
          <Key size={16} />
          {loading ? t('settings.password.changing') : t('settings.password.submit')}
        </button>
      </form>

      {['superadmin', 'admin'].includes(user?.role) && (
        <div className="border-t border-gray-100 pt-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Login-Seite</h3>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Demo-Zugangsdaten anzeigen</p>
              <p className="text-xs text-gray-500 mt-0.5">Zeigt Demo-Credentials auf der Admin-Login-Seite an. Im Produktivbetrieb deaktivieren.</p>
            </div>
            <button
              type="button"
              onClick={handleDemoToggle}
              disabled={savingDemo}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${showDemo ? 'bg-primary-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showDemo ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('locations');
  const { user } = useAuth();

  const TABS = [
    { key: 'locations', label: t('settings.tabs.locations'), icon: MapPin },
    { key: 'purposes', label: t('settings.tabs.purposes'), icon: ListChecks },
    { key: 'users', label: t('settings.tabs.users'), icon: Users, superadminOnly: true },
    { key: 'auto-checkout', label: t('settings.tabs.autoCheckout'), icon: Clock, superadminOnly: true },
    { key: 'gdpr', label: t('settings.tabs.gdpr'), icon: ShieldCheck },
    { key: 'email', label: t('settings.tabs.email'), icon: Mail },
    { key: 'password', label: t('settings.tabs.password'), icon: Key },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.filter(tab => !tab.superadminOnly || user?.role === 'superadmin').map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
              ${activeTab === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'locations' && <LocationsTab />}
        {activeTab === 'purposes' && <PurposesTab />}
        {activeTab === 'users' && user?.role === 'superadmin' && <UsersTab />}
        {activeTab === 'auto-checkout' && user?.role === 'superadmin' && <AutoCheckoutTab />}
        {activeTab === 'gdpr' && <GdprTab />}
        {activeTab === 'email' && <EmailTab />}
        {activeTab === 'password' && <PasswordTab />}
      </div>
    </div>
  );
}
