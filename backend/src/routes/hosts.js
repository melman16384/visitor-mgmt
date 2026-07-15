const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET / - public for kiosk
router.get('/', (req, res) => {
  const { search = '', location_id } = req.query;
  let where = ['h.active = 1'];
  let params = [];

  if (search) {
    where.push('(h.name LIKE ? OR h.email LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (location_id) {
    where.push('h.location_id = ?');
    params.push(location_id);
  }

  const rows = db.prepare(`
    SELECT h.id, h.name, h.email, h.location_id, h.active, h.created_at, l.name as location_name
    FROM hosts h
    LEFT JOIN locations l ON h.location_id = l.id
    WHERE ${where.join(' AND ')}
    ORDER BY h.name ASC
  `).all(...params);

  res.json(rows);
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  const host = db.prepare(`
    SELECT h.id, h.name, h.email, h.location_id, h.active, h.created_at, l.name as location_name
    FROM hosts h
    LEFT JOIN locations l ON h.location_id = l.id
    WHERE h.id = ?
  `).get(req.params.id);
  if (!host) return res.status(404).json({ error: 'Gastgeber nicht gefunden' });
  res.json(host);
});

// POST /
router.post('/', authenticate, (req, res) => {
  const { name, email, location_id } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name und E-Mail erforderlich' });

  const result = db.prepare(`
    INSERT INTO hosts (name, email, location_id)
    VALUES (?, ?, ?)
  `).run(name, email, location_id || null);

  const host = db.prepare('SELECT id, name, email, location_id, active, created_at FROM hosts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(host);
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { name, email, location_id } = req.body;
  db.prepare(`
    UPDATE hosts SET name = ?, email = ?, location_id = ?
    WHERE id = ?
  `).run(name, email, location_id || null, req.params.id);

  const host = db.prepare('SELECT id, name, email, location_id, active, created_at FROM hosts WHERE id = ?').get(req.params.id);
  res.json(host);
});

// PUT /:id/set-password — admin only
router.put('/:id/set-password', authenticate, requireRole(['admin']), (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
  }
  const host = db.prepare('SELECT id FROM hosts WHERE id = ?').get(req.params.id);
  if (!host) return res.status(404).json({ error: 'Gastgeber nicht gefunden' });

  const hash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE hosts SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: 'Portal-Passwort gesetzt' });
});

// DELETE /:id
router.delete('/:id', authenticate, (req, res) => {
  db.prepare('UPDATE hosts SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Gastgeber deaktiviert' });
});

module.exports = router;
