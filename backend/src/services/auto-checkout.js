const db = require('../db/database');
const { log } = require('./audit-log');

function getNextRunMs(timeStr) {
  const [hStr, mStr] = timeStr.split(':');
  const now = new Date();
  const target = new Date();
  target.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

function runAutoCheckout() {
  const enabledRow = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_checkout_enabled'").get();
  if (enabledRow?.value !== 'true') return;

  const result = db.prepare(`
    UPDATE visits SET checked_out_at = ?, status = 'completed'
    WHERE status = 'active'
  `).run(new Date().toISOString());

  if (result.changes > 0) {
    console.log(`[auto-checkout] ${result.changes} Besucher automatisch ausgecheckt`);
    try { log('AUTO_CHECKOUT', 'System', `${result.changes} Besucher automatisch ausgecheckt`); } catch {}
  }
}

function scheduleNext() {
  const timeRow = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_checkout_time'").get();
  const timeStr = timeRow?.value || '19:00';
  const delay = getNextRunMs(timeStr);
  setTimeout(() => {
    runAutoCheckout();
    scheduleNext();
  }, delay);
  const runAt = new Date(Date.now() + delay);
  console.log(`[auto-checkout] Nächster Lauf: ${runAt.toLocaleString('de-DE')}`);
}

module.exports = { scheduleNext };
