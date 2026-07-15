const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const adSync = require('../services/ad-sync');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

// GET /config — current config, bind password masked
router.get('/config', ...adminOnly, (req, res) => {
  const cfg = adSync.getConfig();
  res.json({ ...cfg, bindPassword: cfg.bindPassword ? '••••••••' : '' });
});

// PUT /config
router.put('/config', ...adminOnly, (req, res) => {
  const { url, bindDn, bindPassword, baseDn, filter, enabled } = req.body;
  const fields = {
    ad_ldap_url: url,
    ad_bind_dn: bindDn,
    ad_base_dn: baseDn,
    ad_filter: filter,
    ad_sync_enabled: enabled ? 'true' : 'false',
  };
  if (bindPassword && bindPassword !== '••••••••') fields.ad_bind_password = bindPassword;
  adSync.setConfig(fields);
  const cfg = adSync.getConfig();
  res.json({ ...cfg, bindPassword: cfg.bindPassword ? '••••••••' : '' });
});

// GET /status — last sync time/result
router.get('/status', ...adminOnly, (req, res) => {
  res.json(adSync.getStatus());
});

// POST /sync — trigger sync now
router.post('/sync', ...adminOnly, async (req, res) => {
  try {
    const result = await adSync.runAdSync();
    res.json(result);
  } catch (err) {
    // Not 502/503/504 — Cloudflare intercepts those gateway-class codes and
    // replaces the body with its own generic error page.
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
