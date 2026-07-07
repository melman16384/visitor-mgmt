const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const superadmin = [authenticate, requireRole(['superadmin'])];

function getUserWithLocations(id) {
  const user = db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(id);
  if (!user) return null;
  const locs = db.prepare('SELECT location_id FROM user_locations WHERE user_id = ?').all(id);
  user.location_ids = locs.map(r => r.location_id);
  return user;
}

function setUserLocations(userId, locationIds) {
  db.prepare('DELETE FROM user_locations WHERE user_id = ?').run(userId);
  const insert = db.prepare('INSERT OR IGNORE INTO user_locations (user_id, location_id) VALUES (?, ?)');
  for (const lid of (locationIds || [])) {
    if (lid) insert.run(userId, lid);
  }
}

// POST /:id/unlock — reset lockout
router.post('/:id/unlock', ...superadmin, (req, res) => {
  db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(req.params.id);
  res.json({ message: 'Account entsperrt' });
});

// GET /
router.get('/', ...superadmin, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, active, created_at, failed_login_attempts, locked_until FROM users ORDER BY name ASC').all();
  const locMap = {};
  db.prepare('SELECT user_id, location_id FROM user_locations').all().forEach(r => {
    if (!locMap[r.user_id]) locMap[r.user_id] = [];
    locMap[r.user_id].push(r.location_id);
  });
  rows.forEach(u => { u.location_ids = locMap[u.id] || []; });
  res.json(rows);
});

// POST /
router.post('/', ...superadmin, async (req, res) => {
  const { name, email, password, role, location_ids, active } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, E-Mail und Passwort erforderlich' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  if (!['superadmin', 'admin', 'receptionist'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'E-Mail bereits vergeben' });

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)').run(name, email, hash, role, active !== false ? 1 : 0);
  setUserLocations(result.lastInsertRowid, location_ids);
  res.status(201).json(getUserWithLocations(result.lastInsertRowid));
});

// PUT /:id
router.put('/:id', ...superadmin, (req, res) => {
  const { name, email, role, location_ids, active } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name und E-Mail erforderlich' });
  if (!['superadmin', 'admin', 'receptionist'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' });

  const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
  if (conflict) return res.status(409).json({ error: 'E-Mail bereits vergeben' });

  db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?')
    .run(name, email, role, active ? 1 : 0, req.params.id);
  setUserLocations(req.params.id, location_ids);
  res.json(getUserWithLocations(req.params.id));
});

// POST /:id/reset-password
router.post('/:id/reset-password', ...superadmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: 'Passwort zurückgesetzt' });
});

// DELETE /:id  (deactivate)
router.delete('/:id', ...superadmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Eigenes Konto kann nicht deaktiviert werden' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Benutzer deaktiviert' });
});

module.exports = router;
