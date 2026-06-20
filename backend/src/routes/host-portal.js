const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');
const db = require('../db/database');
const { log } = require('../services/audit-log');
const { generateQR } = require('../services/qrcode');
const { sendPreRegistrationQR } = require('../services/email');

const router = express.Router();

// ── Microsoft SSO helpers ──────────────────────────────────────────────────────

const oauthStates = new Map(); // state token → timestamp (CSRF protection)

function getMsSsoConfig() {
  const get = (key) => db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)?.value || '';
  return {
    enabled:      get('ms_sso_enabled') === '1',
    clientId:     get('ms_client_id'),
    clientSecret: get('ms_client_secret'),
    tenantId:     get('ms_tenant_id'),
  };
}

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const encoded = new URLSearchParams(body).toString();
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(encoded) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error_description || parsed.error));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(encoded);
    req.end();
  });
}

function parseIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return {
      name:  payload.name || payload.preferred_username?.split('@')[0] || '',
      email: payload.email || payload.preferred_username || payload.upn || '',
    };
  } catch { return {}; }
}

function getFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// GET /auth/microsoft — redirect browser to Microsoft login
router.get('/auth/microsoft', (req, res) => {
  const cfg = getMsSsoConfig();
  const frontendUrl = getFrontendUrl(req);
  if (!cfg.enabled || !cfg.clientId || !cfg.tenantId) {
    return res.redirect(`${frontendUrl}/host/login?error=sso_not_configured`);
  }
  // Purge stale states (older than 10 min)
  for (const [k, ts] of oauthStates) {
    if (Date.now() - ts > 600_000) oauthStates.delete(k);
  }
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, Date.now());

  const redirectUri = `${frontendUrl}/api/host-portal/auth/microsoft/callback`;
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email',
    state,
  });
  res.redirect(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize?${params}`);
});

// GET /auth/microsoft/callback — Microsoft redirects here after auth
router.get('/auth/microsoft/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = getFrontendUrl(req);

  if (error) return res.redirect(`${frontendUrl}/host/login?error=${encodeURIComponent(error)}`);

  if (!state || !oauthStates.has(state)) {
    return res.redirect(`${frontendUrl}/host/login?error=invalid_state`);
  }
  oauthStates.delete(state);

  const cfg = getMsSsoConfig();
  const redirectUri = `${frontendUrl}/api/host-portal/auth/microsoft/callback`;

  try {
    const tokens = await httpsPost(
      'login.microsoftonline.com',
      `/${cfg.tenantId}/oauth2/v2.0/token`,
      {
        client_id:     cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        scope:         'openid profile email',
      }
    );

    const { name, email } = parseIdToken(tokens.id_token);
    if (!email) return res.redirect(`${frontendUrl}/host/login?error=no_email`);

    // Find or auto-create host
    let host = db.prepare('SELECT * FROM hosts WHERE email = ?').get(email);
    if (!host) {
      const ins = db.prepare('INSERT INTO hosts (name, email, active) VALUES (?, ?, 1)').run(name || email, email);
      host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(ins.lastInsertRowid);
    } else if (!host.active) {
      db.prepare('UPDATE hosts SET active = 1, name = ? WHERE id = ?').run(name || host.name, host.id);
      host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(host.id);
    }

    const token = jwt.sign(
      { type: 'host', hostId: host.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '12h' }
    );

    try { log('LOGIN', host.email, `Microsoft SSO: ${host.name}`); } catch {}

    res.redirect(`${frontendUrl}/host/login?token=${token}`);
  } catch (err) {
    console.error('[MS SSO] Callback error:', err.message);
    res.redirect(`${frontendUrl}/host/login?error=auth_failed`);
  }
});

// Middleware: Host-JWT prüfen
function authenticateHost(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'secret');
    if (payload.type !== 'host') return res.status(403).json({ error: 'Kein Host-Token' });
    const host = db.prepare('SELECT * FROM hosts WHERE id = ? AND active = 1').get(payload.hostId);
    if (!host) return res.status(401).json({ error: 'Gastgeber nicht gefunden' });
    req.portalHost = host;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function recordFailedHostLogin(id) {
  db.prepare(`
    UPDATE hosts
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= ${MAX_ATTEMPTS} THEN datetime('now', '+${LOCK_MINUTES} minutes')
          ELSE locked_until
        END
    WHERE id = ?
  `).run(id);
}

function recordSuccessfulHostLogin(id) {
  db.prepare('UPDATE hosts SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(id);
}

function checkLocked(row) {
  if (row.locked_until && new Date(row.locked_until + 'Z') > new Date()) {
    const remaining = Math.ceil((new Date(row.locked_until + 'Z') - new Date()) / 60000);
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

  const host = db.prepare('SELECT * FROM hosts WHERE email = ? AND active = 1').get(email);
  if (!host || !host.password_hash) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten oder kein Portal-Zugang eingerichtet' });
  }

  const lockMsg = checkLocked(host);
  if (lockMsg) {
    try { log('LOGIN_BLOCKED', host.email, `Host-Portal gesperrt bis ${host.locked_until}`); } catch {}
    return res.status(429).json({ error: lockMsg });
  }

  const valid = bcrypt.compareSync(password, host.password_hash);
  if (!valid) {
    recordFailedHostLogin(host.id);
    const updated = db.prepare('SELECT failed_login_attempts FROM hosts WHERE id = ?').get(host.id);
    const remaining = MAX_ATTEMPTS - updated.failed_login_attempts;
    try { log('LOGIN_FAILED', host.email, `Host-Portal falsches Passwort (Versuch ${updated.failed_login_attempts}/${MAX_ATTEMPTS})`); } catch {}
    if (remaining <= 0) {
      return res.status(429).json({ error: `Account gesperrt. Bitte in ${LOCK_MINUTES} Minuten erneut versuchen.` });
    }
    return res.status(401).json({ error: `Ungültige Anmeldedaten (noch ${remaining} Versuch${remaining !== 1 ? 'e' : ''})` });
  }

  recordSuccessfulHostLogin(host.id);

  const token = jwt.sign(
    { type: 'host', hostId: host.id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '12h' }
  );

  try { log('LOGIN', host.email, `Host-Portal-Login: ${host.name}`); } catch {}

  const { password_hash, failed_login_attempts, locked_until, ...hostClean } = host;
  res.json({ token, host: hostClean });
});

// GET /me
router.get('/me', authenticateHost, (req, res) => {
  const { password_hash, ...hostWithoutHash } = req.portalHost;
  res.json({ host: hostWithoutHash });
});

// GET /visitors — upcoming preregistrations + active + all completed visits
router.get('/visitors', authenticateHost, (req, res) => {
  const upcoming = db.prepare(`
    SELECT p.*, l.name as location_name
    FROM preregistrations p
    LEFT JOIN locations l ON p.location_id = l.id
    WHERE p.host_id = ? AND p.status = 'pending'
    ORDER BY p.expected_date ASC, p.expected_time ASC
  `).all(req.portalHost.id);

  const active = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.abat_id
    FROM visits v JOIN visitors vi ON v.visitor_id = vi.id
    WHERE v.host_id = ? AND v.status = 'active'
    ORDER BY v.checked_in_at DESC
  `).all(req.portalHost.id);

  const completed = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.abat_id
    FROM visits v JOIN visitors vi ON v.visitor_id = vi.id
    WHERE v.host_id = ? AND v.status = 'completed'
    ORDER BY v.checked_out_at DESC LIMIT 100
  `).all(req.portalHost.id);

  res.json({ upcoming, active, completed });
});

// GET /preregistrations — kommende Vorregistrierungen des Gastgebers
router.get('/preregistrations', authenticateHost, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, l.name as location_name FROM preregistrations p
    LEFT JOIN locations l ON p.location_id = l.id
    WHERE p.host_id = ? AND p.status = 'pending' AND p.expected_date >= date('now')
    ORDER BY p.expected_date ASC, p.expected_time ASC
  `).all(req.portalHost.id);
  res.json(rows);
});

// POST /preregistrations — Vorregistrierung durch Gastgeber erstellen
router.post('/preregistrations', authenticateHost, async (req, res) => {
  const { visitor_first_name, visitor_last_name, visitor_email, visitor_company,
    expected_date, expected_time, purpose, notes } = req.body;

  if (!visitor_first_name || !visitor_last_name || !expected_date) {
    return res.status(400).json({ error: 'Name und Datum erforderlich' });
  }

  const qrCode = `PRE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const host_id = req.portalHost.id;
  const location_id = req.portalHost.location_id || null;

  let abatId = null;
  const result = db.prepare(`
    INSERT INTO preregistrations
      (visitor_first_name, visitor_last_name, visitor_email, visitor_company,
       host_id, location_id, expected_date, expected_time, purpose, qr_code, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    visitor_first_name, visitor_last_name, visitor_email || null, visitor_company || null,
    host_id, location_id, expected_date, expected_time || null,
    purpose || null, qrCode, notes || null
  );

  const prereg = db.prepare('SELECT * FROM preregistrations WHERE id = ?').get(result.lastInsertRowid);

  if (visitor_email) {
    try {
      // Get or create visitor for abat_id
      let visitor = db.prepare('SELECT * FROM visitors WHERE email = ?').get(visitor_email);
      if (!visitor) {
        let newAbatId;
        do {
          newAbatId = 'ABAT-' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        } while (db.prepare('SELECT id FROM visitors WHERE abat_id = ?').get(newAbatId));
        const vr = db.prepare('INSERT INTO visitors (first_name, last_name, email, company, abat_id) VALUES (?, ?, ?, ?, ?)')
          .run(visitor_first_name, visitor_last_name, visitor_email, visitor_company || null, newAbatId);
        visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(vr.lastInsertRowid);
      }
      abatId = visitor.abat_id;

      const qrBuffer = await generateQR(qrCode);
      const location = location_id ? db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id) : null;
      const dateStr = new Date(expected_date).toLocaleDateString('de-DE');
      sendPreRegistrationQR(
        visitor_email, `${visitor_first_name} ${visitor_last_name}`,
        qrBuffer, dateStr, req.portalHost.name,
        abatId, location
      ).catch(console.error);
    } catch (e) {
      console.error('Host-Portal QR/email error:', e);
    }
  }

  try { log('VORREGISTRIERUNG', req.portalHost.name, `${visitor_first_name} ${visitor_last_name}`); } catch {}

  res.status(201).json(prereg);
});

// PUT /change-password
router.put('/change-password', authenticateHost, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' });

  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(req.portalHost.id);
  if (!host.password_hash || !bcrypt.compareSync(current_password, host.password_hash))
    return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE hosts SET password_hash = ? WHERE id = ?').run(hash, req.portalHost.id);
  res.json({ ok: true });
});

module.exports = router;
