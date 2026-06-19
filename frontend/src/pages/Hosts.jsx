import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, Mail, Building, Key } from 'lucide-react';
import Modal from '../components/Modal';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function HostForm({ initial, onSubmit, locations, loading }) {
  const [form, setForm] = useState(initial || { name: '', email: '', location_id: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Dr. Max Mustermann" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail *</label>
        <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={form.email} onChange={e => set('email', e.target.value)} required placeholder="max@firma.de" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={form.location_id} onChange={e => set('location_id', e.target.value)}>
          <option value="">– Standort wählen –</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
          {loading ? 'Wird gespeichert...' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}

export default function Hosts() {
  const [hosts, setHosts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', host }
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pwModal, setPwModal] = useState(null); // host object or null
  const [pwValue, setPwValue] = useState('');
  const { user } = useAuth();

  const loadHosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/hosts', { params: { search } });
      setHosts(res.data);
    } catch {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadHosts(); }, [loadHosts]);
  useEffect(() => { client.get('/locations').then(r => setLocations(r.data)).catch(() => {}); }, []);

  const handleAdd = async (form) => {
    setSubmitting(true);
    try {
      await client.post('/hosts', form);
      showToast('Gastgeber hinzugefügt');
      setModal(null);
      loadHosts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (form) => {
    setSubmitting(true);
    try {
      await client.put(`/hosts/${modal.host.id}`, form);
      showToast('Gastgeber aktualisiert');
      setModal(null);
      loadHosts();
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await client.delete(`/hosts/${deleteConfirm.id}`);
      showToast('Gastgeber deaktiviert');
      setDeleteConfirm(null);
      loadHosts();
    } catch {
      showToast('Fehler beim Löschen', 'error');
    }
  };

  const handleSetPassword = async () => {
    if (!pwValue || pwValue.length < 6) {
      showToast('Passwort muss mindestens 6 Zeichen lang sein', 'error');
      return;
    }
    try {
      await client.put(`/hosts/${pwModal.id}/set-password`, { password: pwValue });
      showToast('Portal-Passwort gesetzt');
      setPwModal(null);
      setPwValue('');
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Setzen des Passworts', 'error');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastgeber</h1>
          <p className="text-sm text-gray-500 mt-0.5">{hosts.length} Gastgeber</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Plus size={18} /> Gastgeber hinzufügen
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Name oder E-Mail..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">E-Mail</th>
              <th className="text-left px-6 py-3">Standort</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-16">
                <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </td></tr>
            ) : hosts.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-16 text-gray-400">Keine Gastgeber gefunden</td></tr>
            ) : hosts.map(h => (
              <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {h.name.split(' ').map(p => p[0]).join('').slice(-2).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{h.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Mail size={12} /><span>{h.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Building size={13} />
                    <span>{h.location_name || '–'}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 justify-end">
                    {user?.role === 'superadmin' && (
                      <button onClick={() => { setPwModal(h); setPwValue(''); }}
                        title="Portal-Passwort setzen"
                        className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                        <Key size={15} />
                      </button>
                    )}
                    <button onClick={() => setModal({ mode: 'edit', host: h })}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteConfirm(h)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Gastgeber hinzufügen' : 'Gastgeber bearbeiten'}
          onClose={() => setModal(null)} size="md">
          <HostForm initial={modal.host} onSubmit={modal.mode === 'add' ? handleAdd : handleEdit}
            locations={locations} loading={submitting} />
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Gastgeber deaktivieren" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 mb-6">Möchten Sie <strong>{deleteConfirm.name}</strong> wirklich deaktivieren?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm(null)}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Abbrechen
            </button>
            <button onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
              Deaktivieren
            </button>
          </div>
        </Modal>
      )}

      {pwModal && (
        <Modal title={`Portal-Passwort setzen: ${pwModal.name}`} onClose={() => { setPwModal(null); setPwValue(''); }} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort (min. 6 Zeichen)</label>
              <input
                type="password"
                value={pwValue}
                onChange={e => setPwValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="••••••"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setPwModal(null); setPwValue(''); }}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Abbrechen
              </button>
              <button onClick={handleSetPassword}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
                Passwort setzen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
