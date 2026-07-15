const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /
router.get('/', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM locations WHERE active = 1 ORDER BY name ASC').all();
  res.json(rows);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Standort nicht gefunden' });
  res.json(loc);
});

// POST /
router.post('/', authenticate, (req, res) => {
  const { name, address, city, country, timezone, contact_name, contact_email, contact_phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  const result = db.prepare(`
    INSERT INTO locations (name, address, city, country, timezone, contact_name, contact_email, contact_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, address || null, city || null, country || null, timezone || 'Europe/Berlin', contact_name || null, contact_email || null, contact_phone || null);
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(loc);
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { name, address, city, country, timezone, contact_name, contact_email, contact_phone, active } = req.body;
  db.prepare(`
    UPDATE locations SET name = ?, address = ?, city = ?, country = ?, timezone = ?, contact_name = ?, contact_email = ?, contact_phone = ?,
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name, address || null, city || null, country || null, timezone || 'Europe/Berlin', contact_name || null, contact_email || null, contact_phone || null,
    active !== undefined ? (active ? 1 : 0) : null, req.params.id
  );

  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  res.json(loc);
});

// DELETE /:id
router.delete('/:id', authenticate, (req, res) => {
  db.prepare('UPDATE locations SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Standort deaktiviert' });
});

module.exports = router;
