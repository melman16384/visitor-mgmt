const jwt = require('jsonwebtoken');
const db = require('../db/database');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ? AND active = 1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    const locationRows = db.prepare('SELECT location_id FROM user_locations WHERE user_id = ?').all(user.id);
    user.location_ids = locationRows.map(r => r.location_id);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht autorisiert' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
