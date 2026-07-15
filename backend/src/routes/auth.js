const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { log } = require('../services/audit-log');
const totp = require('../services/totp');
const { generateQRDataURL } = require('../services/qrcode');

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

function issueSession(user) {
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  const { password_hash, failed_login_attempts, locked_until, totp_secret, totp_backup_codes, ...clean } = user;
  const requires_2fa_setup = user.role === 'admin' && !user.totp_enabled;
  return { token, user: { ...clean, totp_enabled: !!user.totp_enabled }, requires_2fa_setup };
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

  if (user.totp_enabled) {
    const pendingToken = jwt.sign({ userId: user.id, pending2fa: true }, JWT_SECRET, { expiresIn: '5m' });
    try { log('LOGIN_2FA_PENDING', email, 'Passwort ok, warte auf 2FA-Code'); } catch {}
    return res.json({ requires_2fa: true, pending_token: pendingToken });
  }

  try { log('LOGIN', email, 'Admin-Login erfolgreich'); } catch {}
  res.json(issueSession(user));
});

// POST /2fa/login-verify — second step after /login when totp_enabled
router.post('/2fa/login-verify', (req, res) => {
  const { pending_token, token, backup_code } = req.body;
  if (!pending_token || (!token && !backup_code)) {
    return res.status(400).json({ error: 'Code erforderlich' });
  }
  let payload;
  try {
    payload = jwt.verify(pending_token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sitzung abgelaufen, bitte erneut anmelden' });
  }
  if (!payload.pending2fa) return res.status(401).json({ error: 'Ungültiger Token' });

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.userId);
  if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });

  const lockMsg = checkLocked(user);
  if (lockMsg) return res.status(429).json({ error: lockMsg });

  if (backup_code) {
    totp.consumeBackupCode(user.totp_backup_codes, backup_code.trim()).then((remaining) => {
      if (remaining === null) {
        recordFailedLogin('users', user.id);
        try { log('LOGIN_2FA_FAILED', user.email, 'Ungültiger Backup-Code'); } catch {}
        return res.status(401).json({ error: 'Ungültiger Backup-Code' });
      }
      db.prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?').run(JSON.stringify(remaining), user.id);
      recordSuccessfulLogin('users', user.id);
      try { log('LOGIN_2FA_BACKUP', user.email, `Backup-Code verwendet, ${remaining.length} verbleibend`); } catch {}
      res.json(issueSession(user));
    });
    return;
  }

  if (!totp.verifyToken(user.totp_secret, token)) {
    recordFailedLogin('users', user.id);
    try { log('LOGIN_2FA_FAILED', user.email, 'Ungültiger 2FA-Code'); } catch {}
    return res.status(401).json({ error: 'Ungültiger Code' });
  }

  recordSuccessfulLogin('users', user.id);
  try { log('LOGIN_2FA', user.email, '2FA-Bestätigung erfolgreich'); } catch {}
  res.json(issueSession(user));
});

// POST /2fa/setup — generate a new secret for the current user (not yet enabled)
router.post('/2fa/setup', authenticate, async (req, res) => {
  const secret = totp.generateSecret();
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, req.user.id);
  const url = totp.otpauthUrl(secret, req.user.email, COMPANY);
  const qr = await generateQRDataURL(url);
  res.json({ secret, otpauth_url: url, qr });
});

// POST /2fa/verify-setup — confirm setup with a code from the authenticator app
router.post('/2fa/verify-setup', authenticate, async (req, res) => {
  const { token } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.totp_secret) return res.status(400).json({ error: 'Kein 2FA-Setup gestartet' });
  if (!totp.verifyToken(user.totp_secret, token)) {
    return res.status(401).json({ error: 'Ungültiger Code' });
  }
  const backupCodes = totp.generateBackupCodes();
  const hashed = await totp.hashBackupCodes(backupCodes);
  db.prepare('UPDATE users SET totp_enabled = 1, totp_backup_codes = ? WHERE id = ?')
    .run(JSON.stringify(hashed), req.user.id);
  try { log('2FA_AKTIVIERT', req.user.name, req.user.email); } catch {}
  res.json({ message: '2FA aktiviert', backup_codes: backupCodes });
});

// POST /2fa/disable — turn off 2FA for the current user
router.post('/2fa/disable', authenticate, (req, res) => {
  const { password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!password || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Passwort ist falsch' });
  }
  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes = NULL WHERE id = ?').run(req.user.id);
  try { log('2FA_DEAKTIVIERT', req.user.name, req.user.email); } catch {}
  res.json({ message: '2FA deaktiviert' });
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
