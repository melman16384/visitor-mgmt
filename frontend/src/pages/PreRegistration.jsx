import React, { useState, useEffect, useCallback } from 'react';
import { Plus, QrCode, Trash2, ZoomIn, CalendarCheck, UserPlus, Users, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import Modal from '../components/Modal';
import client from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const statusConfig = {
  pending:    { label: 'Ausstehend',  cls: 'bg-yellow-100 text-yellow-700' },
  checked_in: { label: 'Eingecheckt', cls: 'bg-green-100 text-green-700' },
  expired:    { label: 'Abgelaufen',  cls: 'bg-gray-100 text-gray-500' },
  cancelled:  { label: 'Storniert',   cls: 'bg-red-100 text-red-700' },
};

const DATE_FILTERS = [
  { key: 'all',      label: 'Alle' },
  { key: 'today',    label: 'Heute' },
  { key: 'tomorrow', label: 'Morgen' },
  { key: 'week',     label: 'Diese Woche' },
];

const emptyGuest = () => ({ visitor_first_name: '', visitor_last_name: '', visitor_email: '' });

function GuestRow({ guest, index, onChange, onRemove, canRemove }) {
  const set = (k, v) => onChange(index, { ...guest, [k]: v });
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-4">
        <input
          placeholder="Vorname *"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={guest.visitor_first_name}
          onChange={e => set('visitor_first_name', e.target.value)}
          required
        />
      </div>
      <div className="col-span-4">
        <input
          placeholder="Nachname *"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={guest.visitor_last_name}
          onChange={e => set('visitor_last_name', e.target.value)}
          required
        />
      </div>
      <div className="col-span-3">
        <input
          type="email"
          placeholder="E-Mail (für QR)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={guest.visitor_email}
          onChange={e => set('visitor_email', e.target.value)}
        />
      </div>
      <div className="col-span-1 flex justify-end pt-1">
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function PreRegForm({ onSubmit, hosts, locations, purposes, loading }) {
  const [guests, setGuests] = useState([emptyGuest()]);
  const [shared, setShared] = useState({
    visitor_company: '', host_id: '', location_id: '',
    expected_date: '', expected_time: '', purpose: '', notes: '',
  });
  const set = (k, v) => setShared(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (purposes.length > 0 && !shared.purpose) set('purpose', purposes[0].name);
  }, [purposes]);

  const updateGuest = (i, val) => setGuests(gs => gs.map((g, idx) => idx === i ? val : g));
  const addGuest = () => setGuests(gs => [...gs, emptyGuest()]);
  const removeGuest = (i) => setGuests(gs => gs.filter((_, idx) => idx !== i));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ guests, ...shared });
  };

  const isGroup = guests.length > 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Guest rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-700">
            {isGroup ? `Gäste (${guests.length} Personen)` : 'Gast'}
          </label>
          <button type="button" onClick={addGuest}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium px-2.5 py-1.5 border border-primary-200 hover:bg-primary-50 rounded-lg transition-colors">
            <UserPlus size={13} /> Person hinzufügen
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-medium px-0.5">
          <div className="col-span-4">Vorname *</div>
          <div className="col-span-4">Nachname *</div>
          <div className="col-span-3">E-Mail</div>
          <div className="col-span-1" />
        </div>

        <div className="space-y-2">
          {guests.map((g, i) => (
            <GuestRow key={i} guest={g} index={i}
              onChange={updateGuest} onRemove={removeGuest} canRemove={guests.length > 1} />
          ))}
        </div>

        {isGroup && (
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <Users size={13} />
            Gruppenregistrierung — alle {guests.length} Personen erhalten einen eigenen QR-Code
          </div>
        )}
      </div>

      <hr className="border-gray-100" />

      {/* Shared fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unternehmen</label>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={shared.visitor_company} onChange={e => set('visitor_company', e.target.value)}
          placeholder="Gilt für alle Gäste" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Gastgeber *</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={shared.host_id} onChange={e => set('host_id', e.target.value)} required>
          <option value="">– Wählen –</option>
          {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={shared.location_id} onChange={e => set('location_id', e.target.value)}>
            <option value="">– Kein –</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zweck</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={shared.purpose} onChange={e => set('purpose', e.target.value)}>
            {purposes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
          <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={shared.expected_date} onChange={e => set('expected_date', e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
          <input type="time" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={shared.expected_time} onChange={e => set('expected_time', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
        <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={shared.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2">
        {loading ? 'Wird erstellt...' : (
          <>
            {isGroup ? <Users size={16} /> : <Plus size={16} />}
            {isGroup ? `${guests.length} Vorregistrierungen erstellen` : 'Vorregistrierung erstellen'}
          </>
        )}
      </button>
    </form>
  );
}

export default function PreRegistration() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const [items, setItems] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/preregistrations', { params: { date_filter: dateFilter, status: 'pending' } });
      setItems(res.data);
    } catch {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    Promise.all([client.get('/hosts'), client.get('/locations'), client.get('/visit-purposes')])
      .then(([h, l, p]) => { setHosts(h.data); setLocations(l.data); setPurposes(p.data); })
      .catch(() => {});
  }, []);

  const handleCreate = async ({ guests, ...shared }) => {
    setSubmitting(true);
    try {
      if (guests.length === 1) {
        await client.post('/preregistrations', { ...guests[0], ...shared });
      } else {
        await client.post('/preregistrations/batch', { guests, ...shared });
      }
      showToast(guests.length > 1
        ? `${guests.length} Vorregistrierungen erstellt`
        : 'Vorregistrierung erstellt');
      setShowModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await client.delete(`/preregistrations/${id}`);
      showToast('Vorregistrierung storniert');
      loadData();
    } catch {
      showToast('Fehler beim Stornieren', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Vorregistrierung von „${name}" dauerhaft aus der Datenbank löschen?`)) return;
    try {
      await client.delete(`/preregistrations/${id}`);
      showToast('Vorregistrierung gelöscht');
      loadData();
    } catch {
      showToast('Fehler beim Löschen', 'error');
    }
  };

  // Track which group_ids are expanded (collapsed by default for groups)
  const groupIds = [...new Set(items.filter(i => i.group_id).map(i => i.group_id))];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vorregistrierungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} Einträge</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Plus size={18} /> Vorregistrierung erstellen
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
              <th className="text-left px-6 py-3">Besucher</th>
              <th className="text-left px-6 py-3">Gastgeber</th>
              <th className="text-left px-6 py-3">Erwartet</th>
              <th className="text-left px-6 py-3">Zweck</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">QR-Code</th>
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
                Keine Vorregistrierungen gefunden
              </td></tr>
            ) : items.map(item => {
              const sc = statusConfig[item.status] || statusConfig.pending;
              const isGroupMember = !!item.group_id;
              return (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isGroupMember ? 'border-l-2 border-l-blue-200' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{item.visitor_first_name} {item.visitor_last_name}</p>
                        <p className="text-xs text-gray-400">{item.visitor_company || item.visitor_email || '–'}</p>
                      </div>
                      {isGroupMember && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                          <Users size={10} />{item.group_size}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{item.host_name || '–'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <p>{item.expected_date ? format(parseISO(item.expected_date), 'dd.MM.yyyy', { locale: de }) : '–'}</p>
                    {item.expected_time && <p className="text-xs text-gray-400">{item.expected_time} Uhr</p>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{item.purpose || '–'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc.cls}`}>{sc.label}</span>
                  </td>
                  <td className="px-6 py-4">
                    {item.qr_code && (
                      <button onClick={() => setQrPreview(item.qr_code)}
                        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium">
                        <QrCode size={14} /><span>Anzeigen</span><ZoomIn size={12} />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isSuperadmin ? (
                      <button
                        onClick={() => handleDelete(item.id, `${item.visitor_first_name} ${item.visitor_last_name}`)}
                        title="Dauerhaft löschen"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    ) : item.status === 'pending' && (
                      <button onClick={() => handleCancel(item.id)}
                        title="Stornieren"
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
        <Modal title="Vorregistrierung erstellen" onClose={() => setShowModal(false)} size="lg">
          <PreRegForm onSubmit={handleCreate} hosts={hosts} locations={locations} purposes={purposes} loading={submitting} />
        </Modal>
      )}

      {qrPreview && (
        <Modal title="QR-Code" onClose={() => setQrPreview(null)} size="sm">
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
