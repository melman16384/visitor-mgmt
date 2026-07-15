const { Client } = require('ldapts');
const db = require('../db/database');

const CONFIG_KEYS = ['ad_ldap_url', 'ad_bind_dn', 'ad_bind_password', 'ad_base_dn', 'ad_filter', 'ad_sync_enabled'];
const DEFAULT_FILTER = '(&(objectClass=user)(objectCategory=person))';

function getConfig() {
  const rows = db.prepare(`SELECT key, value FROM system_settings WHERE key IN (${CONFIG_KEYS.map(() => '?').join(',')})`).all(...CONFIG_KEYS);
  const raw = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    url: raw.ad_ldap_url || '',
    bindDn: raw.ad_bind_dn || '',
    bindPassword: raw.ad_bind_password || '',
    baseDn: raw.ad_base_dn || '',
    filter: raw.ad_filter || DEFAULT_FILTER,
    enabled: raw.ad_sync_enabled === 'true',
  };
}

function setConfig(fields) {
  const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((f) => {
    for (const [key, value] of Object.entries(f)) {
      if (value !== undefined) upsert.run(key, String(value));
    }
  });
  tx(fields);
}

function getStatus() {
  const rows = db.prepare("SELECT key, value FROM system_settings WHERE key IN ('ad_last_sync_at', 'ad_last_sync_result')").all();
  const raw = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    last_sync_at: raw.ad_last_sync_at || null,
    last_sync_result: raw.ad_last_sync_result ? JSON.parse(raw.ad_last_sync_result) : null,
  };
}

async function runAdSync() {
  const cfg = getConfig();
  if (!cfg.url || !cfg.bindDn || !cfg.baseDn) {
    throw new Error('AD-Sync ist nicht vollständig konfiguriert (Server, Bind-DN und Base-DN erforderlich)');
  }

  const client = new Client({ url: cfg.url });
  const result = { created: 0, updated: 0, deactivated: 0, seen: 0, errors: [] };

  try {
    await client.bind(cfg.bindDn, cfg.bindPassword);

    const { searchEntries } = await client.search(cfg.baseDn, {
      scope: 'sub',
      filter: cfg.filter,
      attributes: ['cn', 'displayName', 'mail', 'telephoneNumber', 'department'],
    });

    const seenDns = [];
    for (const entry of searchEntries) {
      const dn = String(entry.dn);
      const name = String(entry.displayName || entry.cn || '');
      const email = entry.mail ? String(entry.mail) : null;
      if (!name || !email) {
        result.errors.push(`Übersprungen (kein Name/E-Mail): ${dn}`);
        continue;
      }
      seenDns.push(dn);
      result.seen++;

      const phone = entry.telephoneNumber ? String(entry.telephoneNumber) : null;
      const department = entry.department ? String(entry.department) : null;

      const existing = db.prepare('SELECT id FROM hosts WHERE ldap_dn = ?').get(dn);
      if (existing) {
        db.prepare('UPDATE hosts SET name = ?, email = ?, phone = ?, department = ?, active = 1 WHERE id = ?')
          .run(name, email, phone, department, existing.id);
        result.updated++;
      } else {
        db.prepare('INSERT INTO hosts (name, email, phone, department, active, ldap_dn) VALUES (?, ?, ?, ?, 1, ?)')
          .run(name, email, phone, department, dn);
        result.created++;
      }
    }

    // Hosts previously synced from AD but no longer present in the search result get deactivated (soft delete).
    const previouslySynced = db.prepare('SELECT id, ldap_dn FROM hosts WHERE ldap_dn IS NOT NULL AND active = 1').all();
    for (const h of previouslySynced) {
      if (!seenDns.includes(h.ldap_dn)) {
        db.prepare('UPDATE hosts SET active = 0 WHERE id = ?').run(h.id);
        result.deactivated++;
      }
    }
  } finally {
    try { await client.unbind(); } catch {}
  }

  setConfig({ ad_last_sync_at: new Date().toISOString(), ad_last_sync_result: JSON.stringify(result) });
  return result;
}

module.exports = { getConfig, setConfig, getStatus, runAdSync };
