const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { generateBadge } = require('../services/badge');
const { generateQR } = require('../services/qrcode');
const { sendHostNotification, sendVisitorConfirmation } = require('../services/email');
const { log } = require('../services/audit-log');

const router = express.Router();

// Returns SQL fragment + params to restrict by user's location_ids (empty = no restriction)
function locationFilter(user, tableAlias = 'v') {
  const ids = user?.location_ids;
  if (!ids || ids.length === 0) return { sql: '', params: [] };
  const placeholders = ids.map(() => '?').join(',');
  return { sql: `AND ${tableAlias}.location_id IN (${placeholders})`, params: ids };
}

// GET / - paginated list
router.get('/', authenticate, (req, res) => {
  const { search = '', status = 'all', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // "completed": visitors with most recent completed visit, no active visit
  if (status === 'completed') {
    const { sql: locSql, params: locParams } = locationFilter(req.user);
    const searchWhere = search
      ? `AND (vi.first_name LIKE ? OR vi.last_name LIKE ? OR vi.company LIKE ? OR vi.email LIKE ?)`
      : '';
    const s = `%${search}%`;
    const searchParams = search ? [s, s, s, s] : [];

    const total = db.prepare(`
      SELECT COUNT(DISTINCT vi.id) as total
      FROM visitors vi
      INNER JOIN visits v ON v.visitor_id = vi.id AND v.status = 'completed'
        AND v.id = (SELECT MAX(v2.id) FROM visits v2 WHERE v2.visitor_id = vi.id AND v2.status = 'completed')
      WHERE NOT EXISTS (SELECT 1 FROM visits va WHERE va.visitor_id = vi.id AND va.status = 'active')
      ${locSql} ${searchWhere}
    `).get(...locParams, ...searchParams).total;

    const rows = db.prepare(`
      SELECT vi.*,
        v.id as visit_id, v.status as visit_status, v.checked_in_at, v.checked_out_at, v.badge_number, v.purpose,
        COALESCE(h.name, v.host_name_free) as host_name,
        l.name as location_name
      FROM visitors vi
      INNER JOIN visits v ON v.visitor_id = vi.id AND v.status = 'completed'
        AND v.id = (SELECT MAX(v2.id) FROM visits v2 WHERE v2.visitor_id = vi.id AND v2.status = 'completed')
      LEFT JOIN hosts h ON v.host_id = h.id
      LEFT JOIN locations l ON v.location_id = l.id
      WHERE NOT EXISTS (SELECT 1 FROM visits va WHERE va.visitor_id = vi.id AND va.status = 'active')
      ${locSql} ${searchWhere}
      ORDER BY v.checked_out_at DESC
      LIMIT ? OFFSET ?
    `).all(...locParams, ...searchParams, parseInt(limit), offset);

    return res.json({ visitors: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  }

  const { sql: locSql, params: locParams } = locationFilter(req.user);

  let where = [];
  let params = [...locParams];

  if (locSql) where.push(locSql.replace(/^AND /, ''));

  if (search) {
    where.push(`(vi.first_name LIKE ? OR vi.last_name LIKE ? OR vi.company LIKE ? OR vi.email LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (status === 'active') {
    where.push(`v.status = 'active'`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  // For 'all': join most recent visit regardless of status
  // For 'active': join only active visits (WHERE clause filters further)
  const visitJoin = status === 'active'
    ? `LEFT JOIN visits v ON vi.id = v.visitor_id AND v.status = 'active'`
    : `LEFT JOIN visits v ON v.id = (SELECT id FROM visits WHERE visitor_id = vi.id ORDER BY checked_in_at DESC LIMIT 1)`;

  const total = db.prepare(`
    SELECT COUNT(DISTINCT vi.id) as total
    FROM visitors vi
    ${visitJoin}
    LEFT JOIN locations l ON v.location_id = l.id
    ${whereClause}
  `).get(...params).total;

  const rows = db.prepare(`
    SELECT vi.*,
      v.id as visit_id, v.status as visit_status, v.checked_in_at, v.checked_out_at, v.badge_number, v.purpose,
      COALESCE(h.name, v.host_name_free) as host_name, h.id as host_id,
      l.name as location_name
    FROM visitors vi
    ${visitJoin}
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    ${whereClause}
    ORDER BY vi.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const pages = Math.ceil(total / parseInt(limit));
  res.json({ visitors: rows, total, page: parseInt(page), pages });
});

// GET /active
router.get('/active', authenticate, (req, res) => {
  const { sql: locSql, params: locParams } = locationFilter(req.user);
  const rows = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.email,
           COALESCE(h.name, v.host_name_free) as host_name, h.email as host_email,
           l.name as location_name
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    WHERE v.status = 'active' ${locSql}
    ORDER BY v.checked_in_at DESC
  `).all(...locParams);
  res.json(rows);
});

// POST / - create or find visitor + check-in (public for kiosk)
router.post('/', async (req, res) => {
  const { first_name, last_name, email, company, host_id, host_name_free, purpose, nda_signed, location_id, notes, signature_base64 } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'Vor- und Nachname erforderlich' });
  }

  // Find or create visitor
  let visitor = null;
  if (email) {
    visitor = db.prepare('SELECT * FROM visitors WHERE email = ?').get(email);
  }
  if (!visitor) {
    visitor = db.prepare('SELECT * FROM visitors WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?)').get(first_name, last_name);
  }

  if (!visitor) {
    // Generate unique abat-ID
    let abatId;
    do {
      abatId = 'ABAT-' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    } while (db.prepare('SELECT id FROM visitors WHERE abat_id = ?').get(abatId));

    const result = db.prepare(`
      INSERT INTO visitors (first_name, last_name, email, company, nda_signed, nda_signed_at, abat_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(first_name, last_name, email || null, company || null,
      nda_signed ? 1 : 0, nda_signed ? new Date().toISOString() : null, abatId);
    visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(result.lastInsertRowid);
  } else {
    // Update existing visitor info
    db.prepare(`UPDATE visitors SET company = COALESCE(?, company), nda_signed = CASE WHEN ? = 1 THEN 1 ELSE nda_signed END WHERE id = ?`)
      .run(company || null, nda_signed ? 1 : 0, visitor.id);
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

  // Generate badge number
  const badgeNumber = `B-${Date.now().toString().slice(-5)}`;

  // Create visit
  const visitResult = db.prepare(`
    INSERT INTO visits (visitor_id, host_id, host_name_free, location_id, purpose, badge_number, checked_in_at, notes, status, privacy_policy_signed, privacy_policy_signature_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(visitor.id, host_id || null, host_name_free || null, location_id || null, purpose || null, badgeNumber,
    new Date().toISOString(), notes || null,
    signaturePath ? 1 : 0, signaturePath);

  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitResult.lastInsertRowid);

  // Notify host + send visitor confirmation
  let host = null;
  if (host_id) {
    host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(host_id);
    if (host) sendHostNotification(host, visitor, visit).catch(console.error);
  }

  const db2 = require('../db/database');
  const emailConfirmSetting = db2.prepare("SELECT value FROM system_settings WHERE key = 'visitor_email_confirmation'").get();
  if (emailConfirmSetting?.value === 'true') {
    sendVisitorConfirmation(visitor, visit, host).catch(console.error);
  }

  try { log('CHECKIN', 'Kiosk/Empfang', `Besucher: ${visitor.first_name} ${visitor.last_name}`); } catch {}

  res.status(201).json({ visitor, visit });
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Besucher nicht gefunden' });

  const visits = db.prepare(`
    SELECT v.*, COALESCE(h.name, v.host_name_free) as host_name, l.name as location_name
    FROM visits v
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    WHERE v.visitor_id = ?
    ORDER BY v.checked_in_at DESC
  `).all(req.params.id);

  res.json({ visitor, visits });
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { first_name, last_name, email, company, nda_signed } = req.body;
  db.prepare(`
    UPDATE visitors SET first_name = ?, last_name = ?, email = ?, company = ?, nda_signed = ?
    WHERE id = ?
  `).run(first_name, last_name, email, company, nda_signed ? 1 : 0, req.params.id);

  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  res.json(visitor);
});

// POST /:id/checkin
router.post('/:id/checkin', authenticate, async (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Besucher nicht gefunden' });

  const { host_id, purpose, notes, location_id } = req.body;
  const badgeNumber = `B-${Date.now().toString().slice(-5)}`;

  const result = db.prepare(`
    INSERT INTO visits (visitor_id, host_id, location_id, purpose, badge_number, checked_in_at, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(visitor.id, host_id || null, location_id || null, purpose || null, badgeNumber, new Date().toISOString(), notes || null);

  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(result.lastInsertRowid);

  if (host_id) {
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(host_id);
    if (host) sendHostNotification(host, visitor, visit).catch(console.error);
  }

  try { log('CHECKIN', req.user.name, `Besucher: ${visitor.first_name} ${visitor.last_name}`); } catch {}

  res.status(201).json({ visitor, visit });
});

// DELETE /:id — admin only, only if no active visit
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Besucher nicht gefunden' });

  const activeVisit = db.prepare("SELECT id FROM visits WHERE visitor_id = ? AND status = 'active'").get(req.params.id);
  if (activeVisit) return res.status(409).json({ error: 'Besucher ist noch eingecheckt und kann nicht gelöscht werden' });

  db.transaction(() => {
    db.prepare('DELETE FROM visit_documents WHERE visit_id IN (SELECT id FROM visits WHERE visitor_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM visits WHERE visitor_id = ?').run(req.params.id);
    db.prepare('DELETE FROM visitors WHERE id = ?').run(req.params.id);
  })();

  try { log('VISITOR_GELÖSCHT', req.user.name, `${visitor.first_name} ${visitor.last_name}`); } catch {}

  res.json({ message: 'Besucher gelöscht' });
});

// GET /:id/badge/:visitId
router.get('/:id/badge/:visitId', authenticate, async (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  const visit = db.prepare('SELECT * FROM visits WHERE id = ? AND visitor_id = ?').get(req.params.visitId, req.params.id);
  if (!visitor || !visit) return res.status(404).json({ error: 'Nicht gefunden' });

  const host = visit.host_id ? db.prepare('SELECT * FROM hosts WHERE id = ?').get(visit.host_id) : null;

  let qrBuffer = null;
  try {
    qrBuffer = await generateQR(visit.badge_number);
  } catch (e) {}

  const checkinDate = new Date(visit.checked_in_at);
  const pdf = await generateBadge({
    visitorName: `${visitor.first_name} ${visitor.last_name}`,
    company: visitor.company || '',
    hostName: host ? host.name : '',
    date: checkinDate.toLocaleDateString('de-DE'),
    time: checkinDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    qrBuffer,
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="badge-${visitor.last_name}-${visitor.abat_id}.pdf"`,
  });
  res.send(pdf);
});

module.exports = router;
