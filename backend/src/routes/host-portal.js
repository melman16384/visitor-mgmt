const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { log } = require('../services/audit-log');
const { generateQR } = require('../services/qrcode');
const { sendPreRegistrationQR } = require('../services/email');

const router = express.Router();

// Middleware: Host-JWT prüfen
function authenticateHost(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'secret');
    if (payload.type !== 'host') return res.status(403).json({ error: 'Kein Host-Token' });
    const host = db.prepare('SELECT * FROM hosts WHERE id = ? AND active = 1').get(payload.hostId);
    if (!host) return res.status(401).json({ error: 'Gastgeber nicht gefunden' });
    req.host = host;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}

// POST /login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  }

  const host = db.prepare('SELECT * FROM hosts WHERE email = ? AND active = 1').get(email);
  if (!host || !host.password_hash) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten oder kein Portal-Zugang eingerichtet' });
  }

  const valid = bcrypt.compareSync(password, host.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign(
    { type: 'host', hostId: host.id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '12h' }
  );

  try { log('LOGIN', host.email, `Host-Portal-Login: ${host.name}`); } catch {}

  const { password_hash, ...hostWithoutHash } = host;
  res.json({ token, host: hostWithoutHash });
});

// GET /me
router.get('/me', authenticateHost, (req, res) => {
  const { password_hash, ...hostWithoutHash } = req.host;
  res.json({ host: hostWithoutHash });
});

// GET /visitors — upcoming preregistrations + active + all completed visits
router.get('/visitors', authenticateHost, (req, res) => {
  const upcoming = db.prepare(`
    SELECT p.*, l.name as location_name
    FROM preregistrations p
    LEFT JOIN locations l ON p.location_id = l.id
    WHERE p.host_id = ? AND p.status = 'pending'
    ORDER BY p.expected_date ASC, p.expected_time ASC
  `).all(req.host.id);

  const active = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.abat_id
    FROM visits v JOIN visitors vi ON v.visitor_id = vi.id
    WHERE v.host_id = ? AND v.status = 'active'
    ORDER BY v.checked_in_at DESC
  `).all(req.host.id);

  const completed = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.abat_id
    FROM visits v JOIN visitors vi ON v.visitor_id = vi.id
    WHERE v.host_id = ? AND v.status = 'completed'
    ORDER BY v.checked_out_at DESC LIMIT 100
  `).all(req.host.id);

  res.json({ upcoming, active, completed });
});

// GET /preregistrations — kommende Vorregistrierungen des Gastgebers
router.get('/preregistrations', authenticateHost, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, l.name as location_name FROM preregistrations p
    LEFT JOIN locations l ON p.location_id = l.id
    WHERE p.host_id = ? AND p.status = 'pending' AND p.expected_date >= date('now')
    ORDER BY p.expected_date ASC, p.expected_time ASC
  `).all(req.host.id);
  res.json(rows);
});

// POST /preregistrations — Vorregistrierung durch Gastgeber erstellen
router.post('/preregistrations', authenticateHost, async (req, res) => {
  const { visitor_first_name, visitor_last_name, visitor_email, visitor_company,
    expected_date, expected_time, purpose, notes } = req.body;

  if (!visitor_first_name || !visitor_last_name || !expected_date) {
    return res.status(400).json({ error: 'Name und Datum erforderlich' });
  }

  const qrCode = `PRE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const host_id = req.host.id;
  const location_id = req.host.location_id || null;

  let abatId = null;
  const result = db.prepare(`
    INSERT INTO preregistrations
      (visitor_first_name, visitor_last_name, visitor_email, visitor_company,
       host_id, location_id, expected_date, expected_time, purpose, qr_code, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    visitor_first_name, visitor_last_name, visitor_email || null, visitor_company || null,
    host_id, location_id, expected_date, expected_time || null,
    purpose || null, qrCode, notes || null
  );

  const prereg = db.prepare('SELECT * FROM preregistrations WHERE id = ?').get(result.lastInsertRowid);

  if (visitor_email) {
    try {
      // Get or create visitor for abat_id
      let visitor = db.prepare('SELECT * FROM visitors WHERE email = ?').get(visitor_email);
      if (!visitor) {
        let newAbatId;
        do {
          newAbatId = 'ABAT-' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        } while (db.prepare('SELECT id FROM visitors WHERE abat_id = ?').get(newAbatId));
        const vr = db.prepare('INSERT INTO visitors (first_name, last_name, email, company, abat_id) VALUES (?, ?, ?, ?, ?)')
          .run(visitor_first_name, visitor_last_name, visitor_email, visitor_company || null, newAbatId);
        visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(vr.lastInsertRowid);
      }
      abatId = visitor.abat_id;

      const qrBuffer = await generateQR(qrCode);
      const location = location_id ? db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id) : null;
      const dateStr = new Date(expected_date).toLocaleDateString('de-DE');
      sendPreRegistrationQR(
        visitor_email, `${visitor_first_name} ${visitor_last_name}`,
        qrBuffer, dateStr, req.host.name,
        abatId, location
      ).catch(console.error);
    } catch (e) {
      console.error('Host-Portal QR/email error:', e);
    }
  }

  try { log('VORREGISTRIERUNG', req.host.name, `${visitor_first_name} ${visitor_last_name}`); } catch {}

  res.status(201).json(prereg);
});

// PUT /change-password
router.put('/change-password', authenticateHost, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' });

  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(req.host.id);
  if (!host.password_hash || !bcrypt.compareSync(current_password, host.password_hash))
    return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE hosts SET password_hash = ? WHERE id = ?').run(hash, req.host.id);
  res.json({ ok: true });
});

module.exports = router;
