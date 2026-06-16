const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { log } = require('../services/audit-log');

const router = express.Router();

// Checkout by QR code (for kiosk) - no auth required
router.post('/checkout-by-qr', (req, res) => {
  const { qr_code } = req.body;
  if (!qr_code) return res.status(400).json({ error: 'QR-Code fehlt' });

  const visit = db.prepare(`
    SELECT v.*, vis.first_name, vis.last_name, vis.company,
           h.name as host_name
    FROM visits v
    JOIN visitors vis ON vis.id = v.visitor_id
    LEFT JOIN hosts h ON h.id = v.host_id
    WHERE (v.badge_number = ? OR v.qr_code = ?) AND v.status = 'active'
  `).get(qr_code, qr_code);

  if (!visit) return res.status(404).json({ error: 'Kein aktiver Besuch mit diesem QR-Code gefunden' });

  db.prepare(`UPDATE visits SET checked_out_at = CURRENT_TIMESTAMP, status = 'completed' WHERE id = ?`).run(visit.id);
  res.json({ success: true, visitor: { first_name: visit.first_name, last_name: visit.last_name, company: visit.company, host_name: visit.host_name } });
});

// Checkout by abat-ID (for kiosk) - no auth required
router.post('/checkout-by-abat-id', (req, res) => {
  const { abat_id } = req.body;
  if (!abat_id) return res.status(400).json({ error: 'abat-ID fehlt' });

  const visit = db.prepare(`
    SELECT v.*, vis.first_name, vis.last_name, vis.company, vis.abat_id,
           h.name as host_name
    FROM visits v
    JOIN visitors vis ON vis.id = v.visitor_id
    LEFT JOIN hosts h ON h.id = v.host_id
    WHERE vis.abat_id = ? AND v.status = 'active'
    ORDER BY v.checked_in_at DESC LIMIT 1
  `).get(abat_id.toUpperCase());

  if (!visit) return res.status(404).json({ error: 'Kein aktiver Besuch für diese abat-ID gefunden' });

  db.prepare(`UPDATE visits SET checked_out_at = CURRENT_TIMESTAMP, status = 'completed' WHERE id = ?`).run(visit.id);
  res.json({ success: true, visitor: { first_name: visit.first_name, last_name: visit.last_name, company: visit.company, abat_id: visit.abat_id, host_name: visit.host_name } });
});

// Find active visit by visitor name (for kiosk checkout)
router.get('/search-active', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Suchbegriff zu kurz' });

  const visits = db.prepare(`
    SELECT v.id, v.badge_number, v.qr_code, v.checked_in_at,
           vis.first_name, vis.last_name, vis.company,
           h.name as host_name
    FROM visits v
    JOIN visitors vis ON vis.id = v.visitor_id
    LEFT JOIN hosts h ON h.id = v.host_id
    WHERE v.status = 'active'
    AND (vis.first_name || ' ' || vis.last_name LIKE ? OR vis.company LIKE ?)
    ORDER BY v.checked_in_at DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`);

  res.json(visits);
});

// POST /:id/checkout
router.post('/:id/checkout', authenticate, (req, res) => {
  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });
  if (visit.status === 'completed') return res.status(400).json({ error: 'Bereits ausgecheckt' });

  db.prepare(`UPDATE visits SET checked_out_at = ?, status = 'completed' WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id);

  try { log('CHECKOUT', 'System', `Visit-ID: ${req.params.id}`); } catch {}

  const updated = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const visit = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.email,
           h.name as host_name, l.name as location_name
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });
  res.json(visit);
});

module.exports = router;
