const db = require('../db/database');

function runExpiry() {
  const today = new Date().toISOString().split('T')[0];
  const result = db.prepare(`
    UPDATE preregistrations
    SET status = 'expired'
    WHERE status = 'pending' AND expected_date < ?
  `).run(today);

  if (result.changes > 0) {
    console.log(`[prereg-expiry] ${result.changes} abgelaufene Vorregistrierung(en) auf 'expired' gesetzt`);
  }
}

function scheduleExpiry() {
  runExpiry(); // run immediately on start to catch any backlog

  function scheduleNext() {
    const now = new Date();
    const next = new Date();
    next.setHours(0, 5, 0, 0); // 00:05 each day
    if (next <= now) next.setDate(next.getDate() + 1);
    const delay = next - now;
    setTimeout(() => { runExpiry(); scheduleNext(); }, delay);
  }

  scheduleNext();
}

module.exports = { scheduleExpiry };
