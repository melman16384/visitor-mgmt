const { getConfig, runAdSync } = require('./ad-sync');
const { log } = require('./audit-log');

const DAILY_TIME = '03:00'; // off-hours, not user-configurable (only enable/disable is)

function getNextRunMs() {
  const [hStr, mStr] = DAILY_TIME.split(':');
  const now = new Date();
  const target = new Date();
  target.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

async function runScheduledSync() {
  const cfg = getConfig();
  if (!cfg.enabled) return;
  try {
    const result = await runAdSync();
    console.log(`[ad-sync] Erledigt: ${result.created} neu, ${result.updated} aktualisiert, ${result.deactivated} deaktiviert`);
    try { log('AD_SYNC', 'System', `${result.created} neu, ${result.updated} aktualisiert, ${result.deactivated} deaktiviert`); } catch {}
  } catch (e) {
    console.error('[ad-sync] Fehler:', e.message);
    try { log('AD_SYNC_FEHLER', 'System', e.message); } catch {}
  }
}

function scheduleNext() {
  const delay = getNextRunMs();
  setTimeout(() => {
    runScheduledSync().finally(scheduleNext);
  }, delay);
  const runAt = new Date(Date.now() + delay);
  console.log(`[ad-sync] Nächster Lauf: ${runAt.toLocaleString('de-DE')}`);
}

module.exports = { scheduleNext };
