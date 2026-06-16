import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, MapPin, Mail, Key, Save, Check, ListChecks, Users, ShieldCheck, Eye, EyeOff, Printer, Wifi, Clock, GripVertical } from 'lucide-react';
import Modal from '../components/Modal';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'locations', label: 'Standorte', icon: MapPin },
  { key: 'purposes', label: 'Besuchszwecke', icon: ListChecks },
  { key: 'users', label: 'Benutzer', icon: Users, superadminOnly: true },
  { key: 'auto-checkout', label: 'Auto-Checkout', icon: Clock, superadminOnly: true },
  { key: 'printer', label: 'Etikettendrucker', icon: Printer },
  { key: 'gdpr', label: 'Datenschutz', icon: ShieldCheck },
  { key: 'email', label: 'E-Mail-Einstellungen', icon: Mail },
  { key: 'password', label: 'Passwort ändern', icon: Key },
];

function LocationsTab() {
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
      showToast(modal === 'add' ? 'Standort hinzugefügt' : 'Standort aktualisiert');
      setModal(null);
      load();
    } catch { showToast('Fehler', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/locations/${id}`);
      showToast('Standort deaktiviert');
      load();
    } catch { showToast('Fehler', 'error'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{locations.length} Standorte</p>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> Standort hinzufügen
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Adresse</th>
              <th className="text-left px-5 py-3">Stadt</th>
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
        <Modal title={modal === 'add' ? 'Standort hinzufügen' : 'Standort bearbeiten'}
          onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
              {submitting ? 'Speichern...' : 'Speichern'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function PurposesTab() {
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
      showToast(modal === 'add' ? 'Besuchszweck hinzugefügt' : 'Besuchszweck aktualisiert');
      setModal(null);
      load();
    } catch { showToast('Fehler', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/visit-purposes/${id}`);
      showToast('Besuchszweck entfernt');
      load();
    } catch { showToast('Fehler', 'error'); }
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
    } catch { showToast('Reihenfolge konnte nicht gespeichert werden', 'error'); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{purposes.length} Besuchszwecke · Reihenfolge per Drag &amp; Drop ändern</p>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> Zweck hinzufügen
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="w-8 px-3 py-3"></th>
              <th className="text-left px-3 py-3">Bezeichnung</th>
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
        <Modal title={modal === 'add' ? 'Besuchszweck hinzufügen' : 'Besuchszweck bearbeiten'}
          onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
              {submitting ? 'Speichern...' : 'Speichern'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

const ROLE_LABELS = { superadmin: 'Superadmin', admin: 'Admin', receptionist: 'Empfang' };

function UsersTab() {
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
      showToast(modal === 'add' ? 'Benutzer erstellt' : 'Benutzer aktualisiert');
      setModal(null); load();
    } catch (err) { showToast(err.response?.data?.error || 'Fehler', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async (id) => {
    try { await client.delete(`/users/${id}`); showToast('Benutzer deaktiviert'); load(); }
    catch (err) { showToast(err.response?.data?.error || 'Fehler', 'error'); }
  };

  const handleResetPassword = async () => {
    if (!resetPw.password || resetPw.password.length < 8) { showToast('Mindestens 8 Zeichen', 'error'); return; }
    try { await client.post(`/users/${resetPw.userId}/reset-password`, { password: resetPw.password }); showToast('Passwort zurückgesetzt'); setResetPw({ userId: null, password: '' }); }
    catch { showToast('Fehler', 'error'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} Benutzer</p>
        <button onClick={openAdd} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> Benutzer hinzufügen
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">E-Mail</th>
              <th className="text-left px-5 py-3">Rolle</th>
              <th className="text-left px-5 py-3">Standorte</th>
              <th className="text-left px-5 py-3">Status</th>
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
                    <span className="text-xs text-gray-400">Alle</span>
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
                  {u.active ? <span className="text-green-600 text-xs font-semibold">Aktiv</span> : <span className="text-gray-400 text-xs font-semibold">Inaktiv</span>}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => setResetPw({ userId: u.id, password: '' })} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Passwort zurücksetzen"><Key size={14} /></button>
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
        <Modal title={modal === 'add' ? 'Benutzer hinzufügen' : 'Benutzer bearbeiten'} onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[{ k: 'name', l: 'Name' }, { k: 'email', l: 'E-Mail', t: 'email' }].map(({ k, l, t: type }) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l} *</label>
                <input type={type || 'text'} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} required />
              </div>
            ))}
            {modal === 'add' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passwort * (min. 8 Zeichen)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, location_ids: [] }))}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standort-Zugriff
                {form.role !== 'receptionist' && <span className="ml-2 text-xs text-gray-400 font-normal">(nur für Empfang relevant)</span>}
              </label>
              {allLocations.length === 0 ? (
                <p className="text-xs text-gray-400">Keine Standorte angelegt</p>
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
                {(form.location_ids || []).length === 0
                  ? 'Kein Filter — Benutzer sieht alle Standorte'
                  : `Zugriff auf ${(form.location_ids || []).length} Standort(e) beschränkt`}
              </p>
            </div>
            {modal === 'edit' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 text-primary-600 rounded" />
                <span className="text-sm text-gray-700">Benutzer aktiv</span>
              </label>
            )}
            <button type="submit" disabled={submitting} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
              {submitting ? 'Speichern...' : 'Speichern'}
            </button>
          </form>
        </Modal>
      )}

      {resetPw.userId && (
        <Modal title="Passwort zurücksetzen" onClose={() => setResetPw({ userId: null, password: '' })} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort (min. 8 Zeichen)</label>
              <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={resetPw.password} onChange={e => setResetPw(r => ({ ...r, password: e.target.value }))} autoFocus />
            </div>
            <button onClick={handleResetPassword} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
              Passwort zurücksetzen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PrinterTab() {
  const [settings, setSettings] = useState({ printer_enabled: 'false', printer_ip: '', printer_port: '9100' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    client.get('/settings/system').then(r => { setSettings(s => ({ ...s, ...r.data })); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await client.put('/settings/system', settings); setSettings(r.data); showToast('Drucker-Einstellungen gespeichert'); }
    catch { showToast('Fehler', 'error'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try { await client.post('/visitors/printer-test'); showToast('Verbindung erfolgreich — Drucker antwortet'); }
    catch (err) { showToast(err.response?.data?.error || 'Verbindung fehlgeschlagen', 'error'); }
    finally { setTesting(false); }
  };

  if (loading) return <div className="text-gray-400 text-sm">Lade...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-lg">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Brother QL-820NWB</strong> — Etikettengröße DK-11202 (62×100 mm). Drucker muss im selben Netzwerk erreichbar sein (Port 9100, RAW TCP).
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
          checked={settings.printer_enabled === 'true'}
          onChange={e => setSettings(s => ({ ...s, printer_enabled: e.target.checked ? 'true' : 'false' }))} />
        <span className="text-sm font-medium text-gray-700">Etikettendrucker aktivieren</span>
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">IP-Adresse des Druckers *</label>
        <input type="text" placeholder="z.B. 192.168.1.100"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          value={settings.printer_ip} onChange={e => setSettings(s => ({ ...s, printer_ip: e.target.value }))} />
        <p className="text-xs text-gray-400 mt-1">IP-Adresse des QL-820NWB (am Drucker: Netzwerk → IP-Adresse ablesen)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
        <input type="number" min="1" max="65535"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          value={settings.printer_port} onChange={e => setSettings(s => ({ ...s, printer_port: e.target.value }))} />
        <p className="text-xs text-gray-400 mt-1">Standard: 9100 (RAW TCP)</p>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">
          <Save size={15} /> {saving ? 'Speichern...' : 'Speichern'}
        </button>
        <button type="button" onClick={handleTest} disabled={testing || !settings.printer_ip}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-40">
          <Wifi size={15} /> {testing ? 'Verbinde...' : 'Verbindung testen'}
        </button>
      </div>
    </form>
  );
}

function AutoCheckoutTab() {
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
      showToast('Auto-Checkout gespeichert');
    } catch { showToast('Fehler beim Speichern', 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-12 text-center text-gray-400">Laden…</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Automatischer Checkout</h3>
        <p className="text-xs text-gray-500">Besucher, die sich nicht selbst ausgecheckt haben, werden täglich zu der eingestellten Uhrzeit automatisch ausgecheckt.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Auto-Checkout aktivieren</p>
            <p className="text-xs text-gray-500 mt-0.5">Alle noch aktiven Besuche werden automatisch beendet</p>
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
            Uhrzeit für automatischen Checkout
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
        {saving ? 'Speichern…' : 'Speichern'}
      </button>
    </div>
  );
}

function GdprTab() {
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
    try { const r = await client.put('/settings/system', settings); setSettings(r.data); showToast('Einstellungen gespeichert'); }
    catch { showToast('Fehler', 'error'); }
    finally { setSaving(false); }
  };

  const handleCleanup = async () => {
    if (!window.confirm(`Besucherdaten älter als ${settings.gdpr_retention_days} Tage wirklich anonymisieren?`)) return;
    setCleaning(true);
    try { const r = await client.post('/settings/gdpr/cleanup'); setLastResult(r.data); showToast(`${r.data.anonymized} Einträge anonymisiert`); }
    catch { showToast('Fehler', 'error'); }
    finally { setCleaning(false); }
  };

  if (loading) return <div className="text-gray-400 text-sm">Lade...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-lg">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        Persönliche Besucherdaten (Name, E-Mail, Telefon) werden nach der eingestellten Frist automatisch anonymisiert. Besuchsstatistiken bleiben erhalten.
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Aufbewahrungsfrist (Tage)</label>
        <input type="number" min="1" max="3650"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={settings.gdpr_retention_days}
          onChange={e => setSettings(s => ({ ...s, gdpr_retention_days: e.target.value }))} />
        <p className="text-xs text-gray-400 mt-1">Standard: 365 Tage (1 Jahr)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">E-Mail-Bestätigung an Besucher</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Text der Datenschutzerklärung</label>
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
          <Save size={16} /> {saving ? 'Speichern...' : 'Einstellungen speichern'}
        </button>
        <button type="button" onClick={handleCleanup} disabled={cleaning}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm">
          <ShieldCheck size={16} /> {cleaning ? 'Läuft...' : 'Jetzt bereinigen'}
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
      showToast('Verschlüsselung gespeichert');
      const r = await client.get('/settings/smtp-config');
      setConfig(r.data);
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSavingSec(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) { showToast('Bitte Empfänger-E-Mail eingeben', 'error'); return; }
    setTesting(true);
    try {
      const res = await client.post('/settings/email-test', { to: testEmail });
      showToast(res.data.message);
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Senden', 'error');
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
            {testing ? 'Wird gesendet...' : 'Test senden'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordTab() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('Neue Passwörter stimmen nicht überein');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    setLoading(true);
    try {
      await client.put('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      showToast('Passwort erfolgreich geändert');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
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
        { key: 'currentPassword', label: 'Aktuelles Passwort' },
        { key: 'newPassword', label: 'Neues Passwort' },
        { key: 'confirmPassword', label: 'Neues Passwort bestätigen' },
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
        {loading ? 'Wird geändert...' : 'Passwort ändern'}
      </button>
    </form>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('locations');
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Systemkonfiguration und Benutzerverwaltung</p>
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
        {activeTab === 'printer' && <PrinterTab />}
        {activeTab === 'gdpr' && <GdprTab />}
        {activeTab === 'email' && <EmailTab />}
        {activeTab === 'password' && <PasswordTab />}
      </div>
    </div>
  );
}
