const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { generateQR } = require('../services/qrcode');
const { sendPreRegistrationQR, sendHostNotification } = require('../services/email');
const { log } = require('../services/audit-log');

function generateAbatId() {
  return 'ABAT-' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
}

function getOrCreateVisitor(email, firstName, lastName, company) {
  if (email) {
    const existing = db.prepare('SELECT * FROM visitors WHERE email = ?').get(email);
    if (existing) return existing;
  }
  let abatId;
  do { abatId = generateAbatId(); } while (db.prepare('SELECT id FROM visitors WHERE abat_id = ?').get(abatId));
  const r = db.prepare('INSERT INTO visitors (first_name, last_name, email, company, abat_id) VALUES (?, ?, ?, ?, ?)')
    .run(firstName, lastName, email || null, company || null, abatId);
  return db.prepare('SELECT * FROM visitors WHERE id = ?').get(r.lastInsertRowid);
}

const router = express.Router();

const PREREG_SELECT = `
  SELECT p.*, h.name as host_name, l.name as location_name
  FROM preregistrations p
  LEFT JOIN hosts h ON p.host_id = h.id
  LEFT JOIN locations l ON p.location_id = l.id
`;

// GET /qr-image/:qrcode - PUBLIC - returns PNG image
router.get('/qr-image/:qrcode', async (req, res) => {
  try {
    const buf = await generateQR(req.params.qrcode);
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch {
    res.status(500).json({ error: 'QR-Code konnte nicht generiert werden' });
  }
});

// GET /by-abat-id/:abatId - PUBLIC - find pending preregistration by visitor's abat-ID
router.get('/by-abat-id/:abatId', (req, res) => {
  const visitor = db.prepare('SELECT id, email FROM visitors WHERE abat_id = ?').get(req.params.abatId.toUpperCase());
  if (!visitor) return res.status(404).json({ error: 'Keine Vorregistrierung für diese abat-ID gefunden' });
  const prereg = db.prepare(`
    ${PREREG_SELECT}
    WHERE p.visitor_email = ? AND p.status = 'pending'
    ORDER BY p.expected_date ASC LIMIT 1
  `).get(visitor.email);
  if (!prereg) return res.status(404).json({ error: 'Keine offene Vorregistrierung für diese abat-ID gefunden' });
  res.json(prereg);
});

// GET /qr/:qrcode - PUBLIC
router.get('/qr/:qrcode', (req, res) => {
  const prereg = db.prepare(`${PREREG_SELECT} WHERE p.qr_code = ? AND p.status = 'pending'`).get(req.params.qrcode);
  if (!prereg) return res.status(404).json({ error: 'QR-Code nicht gefunden, abgelaufen oder bereits verwendet' });
  res.json(prereg);
});

// POST /qr/:qrcode/checkin - PUBLIC
router.post('/qr/:qrcode/checkin', async (req, res) => {
  const prereg = db.prepare('SELECT * FROM preregistrations WHERE qr_code = ? AND status = ?').get(req.params.qrcode, 'pending');
  if (!prereg) return res.status(404).json({ error: 'Vorregistrierung nicht gefunden oder bereits verwendet' });

  const { signature_base64, first_name, last_name, company } = req.body;

  let visitor = null;
  if (prereg.visitor_email) {
    visitor = db.prepare('SELECT * FROM visitors WHERE email = ?').get(prereg.visitor_email);
  }
  if (!visitor) {
    visitor = getOrCreateVisitor(prereg.visitor_email, prereg.visitor_first_name, prereg.visitor_last_name, prereg.visitor_company);
  }

  // Update visitor info if corrected at kiosk
  if (first_name || last_name || company) {
    db.prepare('UPDATE visitors SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), company = COALESCE(?, company) WHERE id = ?')
      .run(first_name || null, last_name || null, company || null, visitor.id);
    visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(visitor.id);
  }

  // Save privacy policy signature if provided
  let signaturePath = null;
  if (signature_base64) {
    try {
      const sigDir = path.join(__dirname, '../../uploads/signatures');
      if (!fs.existsSync(sigDir)) fs.mkdirSync(sigDir, { recursive: true });
      const sigFilename = `privacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const base64Data = signature_base64.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(sigDir, sigFilename), Buffer.from(base64Data, 'base64'));
      signaturePath = sigFilename;
    } catch (e) { console.error('Signature save error:', e); }
  }

  const badgeNumber = `B-${Date.now().toString().slice(-5)}`;
  const visitResult = db.prepare(`
    INSERT INTO visits (visitor_id, host_id, location_id, purpose, badge_number, qr_code, checked_in_at, status, privacy_policy_signed, privacy_policy_signature_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(visitor.id, prereg.host_id, prereg.location_id, prereg.purpose, badgeNumber, prereg.qr_code, new Date().toISOString(),
    signaturePath ? 1 : 0, signaturePath);

  db.prepare("UPDATE preregistrations SET status = 'checked_in' WHERE id = ?").run(prereg.id);

  const visit = db.prepare(`
    SELECT v.*, h.name as host_name FROM visits v LEFT JOIN hosts h ON h.id = v.host_id WHERE v.id = ?
  `).get(visitResult.lastInsertRowid);
  const host = prereg.host_id ? db.prepare('SELECT * FROM hosts WHERE id = ?').get(prereg.host_id) : null;
  if (host) sendHostNotification(host, visitor, visit).catch(console.error);

  res.json({ visitor, visit, host });
});

// GET /
router.get('/', authenticate, (req, res) => {
  const { date_filter = 'all', status } = req.query;
  let where = [];
  let params = [];

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  if (date_filter === 'today')    { where.push('p.expected_date = ?'); params.push(today); }
  else if (date_filter === 'tomorrow') { where.push('p.expected_date = ?'); params.push(tomorrow); }
  else if (date_filter === 'week') { where.push('p.expected_date BETWEEN ? AND ?'); params.push(today, weekEnd); }

  if (status) { where.push('p.status = ?'); params.push(status); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = db.prepare(`
    ${PREREG_SELECT}
    ${whereClause}
    ORDER BY p.expected_date ASC, p.expected_time ASC
  `).all(...params);

  // Attach group size to each row
  const groupCounts = {};
  rows.forEach(r => {
    if (r.group_id) groupCounts[r.group_id] = (groupCounts[r.group_id] || 0) + 1;
  });
  rows.forEach(r => { r.group_size = r.group_id ? groupCounts[r.group_id] : null; });

  res.json(rows);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const prereg = db.prepare(`${PREREG_SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!prereg) return res.status(404).json({ error: 'Vorregistrierung nicht gefunden' });
  res.json(prereg);
});

// POST / - single registration
router.post('/', authenticate, async (req, res) => {
  const { visitor_first_name, visitor_last_name, visitor_email, visitor_company,
    host_id, host_name_free, location_id, expected_date, expected_time, purpose, notes, group_id } = req.body;

  if (!visitor_first_name || !visitor_last_name || !expected_date) {
    return res.status(400).json({ error: 'Name und Datum erforderlich' });
  }

  const qrCode = `PRE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const result = db.prepare(`
    INSERT INTO preregistrations
      (visitor_first_name, visitor_last_name, visitor_email, visitor_company,
       host_id, host_name_free, location_id, expected_date, expected_time, purpose, qr_code, notes, group_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(visitor_first_name, visitor_last_name, visitor_email || null, visitor_company || null,
    host_id || null, host_name_free || null, location_id || null, expected_date, expected_time || null,
    purpose || null, qrCode, notes || null, group_id || null);

  const prereg = db.prepare('SELECT * FROM preregistrations WHERE id = ?').get(result.lastInsertRowid);

  if (visitor_email) {
    try {
      const visitor = getOrCreateVisitor(visitor_email, visitor_first_name, visitor_last_name, visitor_company);
      const qrBuffer = await generateQR(qrCode);
      const host = host_id ? db.prepare('SELECT * FROM hosts WHERE id = ?').get(host_id) : null;
      const location = location_id ? db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id) : null;
      const dateStr = new Date(expected_date).toLocaleDateString('de-DE');
      sendPreRegistrationQR(
        visitor_email, `${visitor_first_name} ${visitor_last_name}`,
        qrBuffer, dateStr, host ? host.name : (host_name_free || ''),
        visitor.abat_id, location
      ).catch(console.error);
    } catch (e) { console.error('QR/email error:', e); }
  }

  try { log('VORREGISTRIERUNG', req.user?.name || 'Gastgeber', `${visitor_first_name} ${visitor_last_name}`); } catch {}

  res.status(201).json(prereg);
});

// POST /batch - group registration (Variante A)
router.post('/batch', authenticate, async (req, res) => {
  const { guests, host_id, host_name_free, location_id, expected_date, expected_time, purpose, notes, visitor_company } = req.body;

  if (!Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Gast erforderlich' });
  }
  if (!expected_date) return res.status(400).json({ error: 'Datum erforderlich' });

  for (const g of guests) {
    if (!g.visitor_first_name || !g.visitor_last_name) {
      return res.status(400).json({ error: 'Vor- und Nachname für alle Gäste erforderlich' });
    }
  }

  const groupId = guests.length > 1
    ? `GRP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    : null;

  const host = host_id ? db.prepare('SELECT * FROM hosts WHERE id = ?').get(host_id) : null;
  const hostDisplayName = host ? host.name : (host_name_free || '');
  const dateStr = expected_date ? new Date(expected_date).toLocaleDateString('de-DE') : '';

  const created = db.transaction(() => {
    return guests.map(g => {
      const qrCode = `PRE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const r = db.prepare(`
        INSERT INTO preregistrations
          (visitor_first_name, visitor_last_name, visitor_email, visitor_company,
           host_id, host_name_free, location_id, expected_date, expected_time, purpose, qr_code, notes, group_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        g.visitor_first_name, g.visitor_last_name, g.visitor_email || null,
        g.visitor_company || visitor_company || null,
        host_id || null, host_name_free || null, location_id || null, expected_date, expected_time || null,
        purpose || null, qrCode, notes || null, groupId
      );
      return { id: r.lastInsertRowid, qrCode, email: g.visitor_email, name: `${g.visitor_first_name} ${g.visitor_last_name}`, firstName: g.visitor_first_name, lastName: g.visitor_last_name };
    });
  })();

  // Send QR emails async
  const location = location_id ? db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id) : null;
  for (const entry of created) {
    if (entry.email) {
      const visitor = getOrCreateVisitor(entry.email, entry.firstName, entry.lastName, visitor_company || null);
      generateQR(entry.qrCode)
        .then(qrBuffer => sendPreRegistrationQR(
          entry.email, entry.name, qrBuffer, dateStr, hostDisplayName,
          visitor.abat_id, location
        ))
        .catch(console.error);
    }
  }

  res.status(201).json({ count: created.length, group_id: groupId, ids: created.map(e => e.id) });
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { visitor_first_name, visitor_last_name, visitor_email, visitor_company,
    host_id, location_id, expected_date, expected_time, purpose, notes, status } = req.body;

  db.prepare(`
    UPDATE preregistrations SET
      visitor_first_name = ?, visitor_last_name = ?, visitor_email = ?,
      visitor_company = ?, host_id = ?, location_id = ?, expected_date = ?, expected_time = ?,
      purpose = ?, notes = ?, status = COALESCE(?, status)
    WHERE id = ?
  `).run(visitor_first_name, visitor_last_name, visitor_email, visitor_company,
    host_id, location_id, expected_date, expected_time, purpose, notes,
    status || null, req.params.id);

  const prereg = db.prepare('SELECT * FROM preregistrations WHERE id = ?').get(req.params.id);
  res.json(prereg);
});

// DELETE /:id — superadmin: permanent delete; others: soft cancel
router.delete('/:id', authenticate, (req, res) => {
  const prereg = db.prepare('SELECT id FROM preregistrations WHERE id = ?').get(req.params.id);
  if (!prereg) return res.status(404).json({ error: 'Vorregistrierung nicht gefunden' });

  if (req.user.role === 'superadmin') {
    db.prepare('DELETE FROM preregistrations WHERE id = ?').run(req.params.id);
    try { log('VORREGISTRIERUNG_GELÖSCHT', req.user.name, `Vorregistrierung ID ${req.params.id}`); } catch {}
    res.json({ message: 'Vorregistrierung gelöscht' });
  } else {
    db.prepare("UPDATE preregistrations SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Vorregistrierung storniert' });
  }
});

module.exports = router;
