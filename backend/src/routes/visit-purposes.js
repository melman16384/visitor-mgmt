const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET / - public (kiosk needs this)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM visit_purposes WHERE active = 1 ORDER BY sort_order ASC, name ASC').all();
  res.json(rows);
});

// POST /
router.post('/', authenticate, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM visit_purposes').get().m;
  const result = db.prepare('INSERT INTO visit_purposes (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder + 1);
  res.status(201).json(db.prepare('SELECT * FROM visit_purposes WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /reorder - must be before /:id to avoid Express matching 'reorder' as an id
router.put('/reorder', authenticate, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array erforderlich' });
  const update = db.prepare('UPDATE visit_purposes SET sort_order = ? WHERE id = ?');
  db.transaction(() => { order.forEach(({ id, sort_order }) => update.run(sort_order, id)); })();
  res.json({ ok: true });
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  const { name, sort_order } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  db.prepare('UPDATE visit_purposes SET name = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name.trim(), sort_order ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM visit_purposes WHERE id = ?').get(req.params.id));
});

// DELETE /:id
router.delete('/:id', authenticate, (req, res) => {
  db.prepare('UPDATE visit_purposes SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Besuchszweck deaktiviert' });
});

module.exports = router;
