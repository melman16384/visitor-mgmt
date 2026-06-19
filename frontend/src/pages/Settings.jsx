import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, MapPin, Mail, Key, Save, Check, ListChecks, Users, ShieldCheck, Eye, EyeOff, Printer, Wifi, Clock, GripVertical, Server, RefreshCw, PlugZap } from 'lucide-react';
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

function PrinterTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({ printer_enabled: 'false', printer_ip: '', printer_port: '9100' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    client.get('/settings/system').then(r => { setSettings(s => ({ ...s, ...r.data })); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await client.put('/settings/system', settings); setSettings(r.data); showToast(t('settings.printer.saved')); }
    catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try { await client.post('/visitors/printer-test'); showToast(t('settings.printer.testSuccess')); }
    catch (err) { showToast(err.response?.data?.error || t('settings.printer.testError'), 'error'); }
    finally { setTesting(false); }
  };

  if (loading) return <div className="text-gray-400 text-sm">{t('common.loading')}</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-lg">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Brother QL-820NWB</strong> — Etikettengröße DK-11202 (62×100 mm). Drucker muss im selben Netzwerk erreichbar sein (Port 9100, RAW TCP).
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
          checked={settings.printer_enabled === 'true'}
          onChange={e => setSettings(s => ({ ...s, printer_enabled: e.target.checked ? 'true' : 'false' }))} />
        <span className="text-sm font-medium text-gray-700">{t('settings.printer.enable')}</span>
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.printer.ip')} *</label>
        <input type="text" placeholder="z.B. 192.168.1.100"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          value={settings.printer_ip} onChange={e => setSettings(s => ({ ...s, printer_ip: e.target.value }))} />
        <p className="text-xs text-gray-400 mt-1">IP-Adresse des QL-820NWB (am Drucker: Netzwerk → IP-Adresse ablesen)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.printer.port')}</label>
        <input type="number" min="1" max="65535"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          value={settings.printer_port} onChange={e => setSettings(s => ({ ...s, printer_port: e.target.value }))} />
        <p className="text-xs text-gray-400 mt-1">Standard: 9100 (RAW TCP)</p>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">
          <Save size={15} /> {saving ? t('common.loading') : t('settings.printer.save')}
        </button>
        <button type="button" onClick={handleTest} disabled={testing || !settings.printer_ip}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-40">
          <Wifi size={15} /> {testing ? t('common.loading') : t('settings.printer.test')}
        </button>
      </div>
    </form>
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
  const [config, setConfig] = useState(null);
  const [security, setSecurity] = useState('starttls');
  const [savingSec, setSavingSec] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    client.get('/settings/system')
      .then(r => { if (r.data.smtp_security) setSecurity(r.data.smtp_security); })
      .catch(() => {});
    client.get('/settings/smtp-config')
      .then(r => setConfig(r.data))
      .catch(() => {});
  }, []);

  const handleSecurityChange = async (val) => {
    setSecurity(val);
    setSavingSec(true);
    try {
      await client.put('/settings/system', { smtp_security: val });
      showToast(t('settings.email.saved'));
      const r = await client.get('/settings/smtp-config');
      setConfig(r.data);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setSavingSec(false);
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

  const CONFIG_FIELDS = [
    { key: 'smtp_host',    label: 'SMTP-Host' },
    { key: 'smtp_port',    label: 'SMTP-Port' },
    { key: 'smtp_user',    label: 'SMTP-Benutzer' },
    { key: 'smtp_pass',    label: 'SMTP-Passwort' },
    { key: 'from_email',   label: 'Absender-E-Mail' },
    { key: 'company_name', label: 'Firmenname' },
  ];

  return (
    <div className="space-y-6 max-w-lg">
      {/* SMTP config display */}
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          SMTP-Einstellungen werden in der <code className="font-mono bg-blue-100 px-1 rounded">.env</code>-Datei gespeichert. Nach Änderungen ist ein Server-Neustart erforderlich.
        </div>
        {CONFIG_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className={`w-full border rounded-lg px-3 py-2 text-sm font-mono ${
              config ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-gray-100 border-gray-200 text-gray-400'
            }`}>
              {config
                ? (config[key] || <span className="text-gray-400 italic">nicht konfiguriert</span>)
                : <span className="animate-pulse">Lädt…</span>}
            </div>
          </div>
        ))}
      </div>

      <hr className="border-gray-100" />

      {/* Security selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Verschlüsselung</h3>
          {savingSec && <span className="text-xs text-gray-400 animate-pulse">Speichert...</span>}
        </div>
        <div className="space-y-2">
          {SECURITY_OPTIONS.map(opt => (
            <label key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                security === opt.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}>
              <input type="radio" name="smtp_security" value={opt.value}
                checked={security === opt.value}
                onChange={() => handleSecurityChange(opt.value)}
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
        <p className="text-xs text-gray-400">
          Wird sofort gespeichert und beim nächsten E-Mail-Versand verwendet — kein Neustart nötig.
        </p>
      </div>

      <hr className="border-gray-100" />

      {/* Test email */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Mail size={15} className="text-gray-400" /> Test-E-Mail senden
        </h3>
        <p className="text-xs text-gray-400">
          Prüft die SMTP-Verbindung und sendet eine Test-E-Mail mit den aktuellen Einstellungen.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Empfänger-E-Mail"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
          />
          <button
            onClick={handleTest}
            disabled={testing || !testEmail}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
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
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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
  );
}

function LdapTab() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState({
    ldap_enabled: 'false',
    ldap_url: '',
    ldap_bind_dn: '',
    ldap_bind_password: '',
    ldap_base_dn: '',
    ldap_filter: '(objectClass=user)',
    ldap_attr_name: 'displayName',
    ldap_attr_email: 'mail',
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    client.get('/settings/ldap').then(r => setCfg(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await client.put('/settings/ldap', cfg);
      setCfg(r.data);
      showToast(t('settings.ldap.saved'));
    } catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await client.post('/settings/ldap/test');
      showToast(r.data.message || t('settings.ldap.testSuccess'), 'success');
    } catch (e) {
      showToast(e.response?.data?.error || t('common.error'), 'error');
    } finally { setTesting(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await client.post('/settings/ldap/sync');
      setSyncResult(r.data);
      showToast(t('settings.ldap.syncResult'));
    } catch (e) {
      showToast(e.response?.data?.error || t('common.error'), 'error');
    } finally { setSyncing(false); }
  };

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
  const label = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Enable toggle */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">LDAP / Active Directory aktivieren</p>
          <p className="text-xs text-gray-500 mt-0.5">Gastgeber werden aus dem Verzeichnisdienst synchronisiert</p>
        </div>
        <button onClick={() => set('ldap_enabled', cfg.ldap_enabled === 'true' ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cfg.ldap_enabled === 'true' ? 'bg-primary-600' : 'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${cfg.ldap_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Connection */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><PlugZap size={15} /> Verbindung</h3>
        <div>
          <label className={label}>Server-URL</label>
          <input value={cfg.ldap_url} onChange={e => set('ldap_url', e.target.value)}
            placeholder="ldap://dc.firma.de:389 oder ldaps://dc.firma.de:636"
            className={inp} />
        </div>
        <div>
          <label className={label}>Bind DN (Service-Account)</label>
          <input value={cfg.ldap_bind_dn} onChange={e => set('ldap_bind_dn', e.target.value)}
            placeholder="CN=svc-visitor,OU=ServiceAccounts,DC=firma,DC=de"
            className={inp} />
        </div>
        <div>
          <label className={label}>Bind-Passwort</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={cfg.ldap_bind_password}
              onChange={e => set('ldap_bind_password', e.target.value)}
              placeholder="Passwort des Service-Accounts"
              className={inp + ' pr-10'} />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Wird verschlüsselt in der Datenbank gespeichert.</p>
        </div>
        <button onClick={handleTest} disabled={testing || !cfg.ldap_url}
          className="flex items-center gap-2 border border-gray-300 hover:border-primary-400 hover:text-primary-700 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40">
          <PlugZap size={15} />
          {testing ? t('common.loading') : t('settings.ldap.test')}
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Suchabfrage</h3>
        <div>
          <label className={label}>Base DN</label>
          <input value={cfg.ldap_base_dn} onChange={e => set('ldap_base_dn', e.target.value)}
            placeholder="OU=Users,DC=firma,DC=de"
            className={inp} />
        </div>
        <div>
          <label className={label}>LDAP-Filter</label>
          <input value={cfg.ldap_filter} onChange={e => set('ldap_filter', e.target.value)}
            placeholder="(&(objectClass=user)(extensionAttribute3=VisitorHost))"
            className={inp} />
          <p className="text-xs text-gray-400 mt-1">
            Tipp: Mit <code className="bg-gray-100 px-1 rounded">extensionAttribute1–15</code> lassen sich gezielt nur bestimmte AD-Benutzer auswählen.
          </p>
        </div>
      </div>

      {/* Attribute mapping */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Attribut-Zuordnung</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'ldap_attr_name', label: 'Name', placeholder: 'displayName' },
            { key: 'ldap_attr_email', label: 'E-Mail', placeholder: 'mail' },
          ].map(({ key, label: lbl, placeholder }) => (
            <div key={key}>
              <label className={label}>{lbl}</label>
              <input value={cfg[key]} onChange={e => set(key, e.target.value)}
                placeholder={placeholder} className={inp} />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
          <Save size={15} />
          {saving ? t('common.loading') : t('settings.ldap.save')}
        </button>
        <button onClick={handleSync} disabled={syncing || cfg.ldap_enabled !== 'true'}
          className="flex items-center gap-2 border border-gray-300 hover:border-primary-400 hover:text-primary-700 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40">
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? t('common.loading') : t('settings.ldap.sync')}
        </button>
      </div>

      {syncResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          <p className="font-semibold">Synchronisierung abgeschlossen</p>
          <p className="mt-1">
            {syncResult.synced} Gastgeber synchronisiert
            {syncResult.skipped > 0 && ` · ${syncResult.skipped} übersprungen (fehlende E-Mail oder Name)`}
            {' '}· {syncResult.total} Einträge gesamt gefunden
          </p>
        </div>
      )}
    </div>
  );
}

function MicrosoftSsoTab() {
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
  const label = 'block text-sm font-medium text-gray-700 mb-1';

  const [cfg, setCfg] = useState({
    ms_sso_enabled: '0',
    ms_client_id: '',
    ms_client_secret: '',
    ms_tenant_id: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get('/settings/ms-sso').then(r => setCfg(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await client.put('/settings/ms-sso', cfg);
      setCfg(r.data);
      showToast('Microsoft SSO gespeichert');
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isEnabled = cfg.ms_sso_enabled === '1';

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Microsoft Single Sign-On</h2>
          <p className="text-sm text-gray-500">
            Mitarbeiter können sich über ihr Microsoft-Konto (Azure AD / Entra ID) am Gastgeber-Portal anmelden und werden automatisch als Gastgeber angelegt.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-800 text-sm">Microsoft SSO aktivieren</p>
          <button onClick={() => set('ms_sso_enabled', isEnabled ? '0' : '1')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isEnabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label}>Client-ID (Application ID)</label>
            <input className={inp} value={cfg.ms_client_id}
              onChange={e => set('ms_client_id', e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </div>
          <div>
            <label className={label}>Client-Secret</label>
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} className={`${inp} pr-10`}
                value={cfg.ms_client_secret}
                onChange={e => set('ms_client_secret', e.target.value)}
                placeholder="••••••••" />
              <button type="button" onClick={() => setShowSecret(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className={label}>Tenant-ID (Verzeichnis-ID)</label>
            <input className={inp} value={cfg.ms_tenant_id}
              onChange={e => set('ms_tenant_id', e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </div>
        </div>

        {/* Setup instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
          <p className="font-semibold text-blue-800">Azure App Registration – Anleitung</p>
          <ol className="list-decimal list-inside text-blue-700 space-y-1 text-xs">
            <li>Öffnen Sie das <strong>Azure Portal</strong> → App-Registrierungen → Neue Registrierung</li>
            <li>Name: z. B. „Visitor Management", Kontotyp: <em>Nur dieser Organisation</em></li>
            <li>Redirect-URI: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/api/host-portal/auth/microsoft/callback</code></li>
            <li>Nach der Erstellung: Client-ID und Tenant-ID aus der Übersicht kopieren</li>
            <li>Unter <em>Zertifikate &amp; Geheimnisse</em>: Neues Client-Secret erstellen und kopieren</li>
            <li>Unter <em>API-Berechtigungen</em>: <code className="bg-blue-100 px-1 rounded">openid profile email</code> sicherstellen</li>
          </ol>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
          {saving ? 'Speichern…' : 'Einstellungen speichern'}
        </button>
      </div>
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
    { key: 'printer', label: t('settings.tabs.printer'), icon: Printer },
    { key: 'ldap', label: t('settings.tabs.ldap'), icon: Server, superadminOnly: true },
    { key: 'ms-sso', label: 'Microsoft SSO', icon: PlugZap, superadminOnly: true },
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
        {activeTab === 'ldap' && user?.role === 'superadmin' && <LdapTab />}
        {activeTab === 'ms-sso' && user?.role === 'superadmin' && <MicrosoftSsoTab />}
        {activeTab === 'printer' && <PrinterTab />}
        {activeTab === 'gdpr' && <GdprTab />}
        {activeTab === 'email' && <EmailTab />}
        {activeTab === 'password' && <PasswordTab />}
      </div>
    </div>
  );
}
