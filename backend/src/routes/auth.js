const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { log } = require('../services/audit-log');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
const COMPANY = process.env.COMPANY_NAME || 'abat AG';

function recordFailedLogin(table, id) {
  db.prepare(`
    UPDATE ${table}
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= ? THEN datetime('now', '+${LOCK_MINUTES} minutes')
          ELSE locked_until
        END
    WHERE id = ?
  `).run(MAX_ATTEMPTS, id);
}

function recordSuccessfulLogin(table, id) {
  db.prepare(`UPDATE ${table} SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`).run(id);
}

function checkLocked(user) {
  if (user.locked_until && new Date(user.locked_until + 'Z') > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until + 'Z') - new Date()) / 60000);
    return `Account gesperrt. Bitte in ${remaining} Minute${remaining !== 1 ? 'n' : ''} erneut versuchen.`;
  }
  return null;
}

// POST /login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user) {
    try { log('LOGIN_FAILED', email, 'Benutzer nicht gefunden'); } catch {}
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const lockMsg = checkLocked(user);
  if (lockMsg) {
    try { log('LOGIN_BLOCKED', email, `Account gesperrt bis ${user.locked_until}`); } catch {}
    return res.status(429).json({ error: lockMsg });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    recordFailedLogin('users', user.id);
    const updated = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(user.id);
    const remaining = MAX_ATTEMPTS - updated.failed_login_attempts;
    try { log('LOGIN_FAILED', email, `Falsches Passwort (Versuch ${updated.failed_login_attempts}/${MAX_ATTEMPTS})`); } catch {}
    if (remaining <= 0) {
      return res.status(429).json({ error: `Account gesperrt. Bitte in ${LOCK_MINUTES} Minuten erneut versuchen.` });
    }
    return res.status(401).json({ error: `Ungültige Anmeldedaten (noch ${remaining} Versuch${remaining !== 1 ? 'e' : ''})` });
  }

  recordSuccessfulLogin('users', user.id);

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  try { log('LOGIN', email, 'Admin-Login erfolgreich'); } catch {}
  const { password_hash, failed_login_attempts, locked_until, totp_secret, totp_enabled, ...clean } = user;
  res.json({ token, user: clean });
});

// GET /me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Erfolgreich abgemeldet' });
});

// PUT /change-password
router.put('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen lang sein' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ message: 'Passwort erfolgreich geändert' });
});

module.exports = router;
