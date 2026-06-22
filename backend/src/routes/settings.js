const express = require('express');
const nodemailer = require('nodemailer');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const { getSmtpConfig } = require('../services/email');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['superadmin', 'admin'])];
const superadminOnly = [authenticate, requireRole(['superadmin'])];

// GET /system — all settings
router.get('/system', ...adminOnly, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

// PUT /system — update one or more settings
router.put('/system', ...adminOnly, (req, res) => {
  const allowed = ['gdpr_retention_days', 'visitor_email_confirmation', 'printer_enabled', 'printer_ip', 'printer_port', 'smtp_security', 'privacy_policy_text', 'privacy_policy_enabled', 'auto_checkout_enabled', 'auto_checkout_time', 'show_demo_credentials'];
  const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  const updateMany = db.transaction((updates) => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) upsert.run(key, String(value));
    }
  });
  updateMany(req.body);
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

function getSecurityOptions(security) {
  switch (security) {
    case 'ssl':  return { secure: true };
    case 'none': return { secure: false, ignoreTLS: true };
    default:     return { secure: false };
  }
}

// GET /privacy-policy - PUBLIC - kiosk reads this without auth
router.get('/privacy-policy', (req, res) => {
  const textRow = db.prepare("SELECT value FROM system_settings WHERE key = 'privacy_policy_text'").get();
  const enabledRow = db.prepare("SELECT value FROM system_settings WHERE key = 'privacy_policy_enabled'").get();
  const demoRow = db.prepare("SELECT value FROM system_settings WHERE key = 'show_demo_credentials'").get();
  res.json({
    text: textRow?.value || '',
    enabled: enabledRow?.value !== 'false',
    show_demo_credentials: demoRow?.value !== 'false',
  });
});

// GET /smtp-config — current SMTP config (DB → .env fallback), password masked
router.get('/smtp-config', ...adminOnly, (req, res) => {
  const cfg = getSmtpConfig();
  res.json({
    smtp_host:  cfg.host,
    smtp_port:  String(cfg.port),
    smtp_user:  cfg.user,
    smtp_pass:  cfg.pass ? '••••••••' : '',
    from_email: cfg.fromEmail,
    from_name:  cfg.fromName,
    company_name: cfg.company,
    smtp_security: cfg.security,
  });
});

// PUT /smtp-config — save SMTP config to DB (superadmin only)
router.put('/smtp-config', ...superadminOnly, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((body) => {
    const fields = ['smtp_host', 'smtp_port', 'smtp_user', 'from_email', 'from_name', 'smtp_security', 'company_name'];
    for (const key of fields) {
      if (key in body && body[key] !== undefined) upsert.run(key, String(body[key]));
    }
    if (body.smtp_pass && body.smtp_pass !== '••••••••') {
      upsert.run('smtp_pass', body.smtp_pass);
    }
  });
  tx(req.body);
  const cfg = getSmtpConfig();
  res.json({
    smtp_host:  cfg.host,
    smtp_port:  String(cfg.port),
    smtp_user:  cfg.user,
    smtp_pass:  cfg.pass ? '••••••••' : '',
    from_email: cfg.fromEmail,
    from_name:  cfg.fromName,
    company_name: cfg.company,
    smtp_security: cfg.security,
  });
});

// POST /email-test — send a test email using current SMTP config
router.post('/email-test', ...adminOnly, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Empfänger-E-Mail erforderlich' });

  const cfg = getSmtpConfig();
  if (!cfg.user || cfg.user === 'your@email.com') {
    return res.status(400).json({ error: 'SMTP nicht konfiguriert' });
  }

  const SECURITY_LABELS = { starttls: 'STARTTLS', ssl: 'SSL/TLS', none: 'Keine' };
  const fromAddr = `"${cfg.fromName || cfg.company + ' Besucherverwaltung'}" <${cfg.fromEmail}>`;

  try {
    const transport = nodemailer.createTransport({
      host: cfg.host, port: cfg.port,
      ...getSecurityOptions(cfg.security),
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transport.verify();
    await transport.sendMail({
      from: fromAddr, to,
      subject: `Test-E-Mail — ${cfg.company} Besucherverwaltung`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#004B87;">Test-E-Mail</h2>
          <p>Diese E-Mail bestätigt, dass die SMTP-Konfiguration korrekt funktioniert.</p>
          <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:4px 16px 4px 0;color:#666;">SMTP-Server</td><td style="font-weight:600;">${cfg.host}:${cfg.port}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#666;">Verschlüsselung</td><td style="font-weight:600;">${SECURITY_LABELS[cfg.security] || cfg.security}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#666;">Absender</td><td style="font-weight:600;">${fromAddr}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#666;">Gesendet um</td><td style="font-weight:600;">${new Date().toLocaleString('de-DE')}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#999;font-size:12px;">Automatisch generiert von der Besucherverwaltung.</p>
        </div>
      `,
    });
    res.json({ message: `Test-E-Mail erfolgreich an ${to} gesendet` });
  } catch (err) {
    res.status(502).json({ error: `SMTP-Fehler: ${err.message}` });
  }
});

// POST /gdpr/cleanup — anonymize old visitor data
router.post('/gdpr/cleanup', ...adminOnly, (req, res) => {
  const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'gdpr_retention_days'").get();
  const days = parseInt(setting?.value || '365');
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    UPDATE visitors SET
      first_name = '[GELÖSCHT]',
      last_name = '[GELÖSCHT]',
      email = NULL,
      phone = NULL,
      company = NULL,
      photo_path = NULL
    WHERE created_at < ?
    AND id NOT IN (SELECT DISTINCT visitor_id FROM visits WHERE status = 'active')
    AND first_name != '[GELÖSCHT]'
  `).run(cutoff);

  res.json({ anonymized: result.changes, cutoff_date: cutoff, retention_days: days });
});

// GET /ms-sso — current MS SSO config (secret masked)
router.get('/ms-sso', ...superadminOnly, (req, res) => {
  const get = (key) => db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)?.value || '';
  const secret = get('ms_client_secret');
  res.json({
    ms_sso_enabled:  get('ms_sso_enabled') || '0',
    ms_client_id:    get('ms_client_id'),
    ms_client_secret: secret ? '••••••••' : '',
    ms_tenant_id:    get('ms_tenant_id'),
  });
});

// PUT /ms-sso — save MS SSO config
router.put('/ms-sso', ...superadminOnly, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((body) => {
    if ('ms_sso_enabled' in body) upsert.run('ms_sso_enabled', String(body.ms_sso_enabled));
    if ('ms_client_id'   in body) upsert.run('ms_client_id',   String(body.ms_client_id));
    if ('ms_tenant_id'   in body) upsert.run('ms_tenant_id',   String(body.ms_tenant_id));
    if (body.ms_client_secret && body.ms_client_secret !== '••••••••') {
      upsert.run('ms_client_secret', body.ms_client_secret);
    }
  });
  tx(req.body);
  const get = (key) => db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)?.value || '';
  const secret = get('ms_client_secret');
  res.json({
    ms_sso_enabled:   get('ms_sso_enabled') || '0',
    ms_client_id:     get('ms_client_id'),
    ms_client_secret: secret ? '••••••••' : '',
    ms_tenant_id:     get('ms_tenant_id'),
  });
});

// GET /ms-sso/status — public — tells frontend if SSO button should appear
router.get('/ms-sso/status', (req, res) => {
  const get = (key) => db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)?.value || '';
  const enabled = get('ms_sso_enabled') === '1';
  const configured = !!(get('ms_client_id') && get('ms_client_secret') && get('ms_tenant_id'));
  res.json({ available: enabled && configured });
});

module.exports = router;
