const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/visitors.db';
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.resolve(dbPath));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'receptionist',
      location_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      department TEXT,
      location_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      photo_path TEXT,
      nda_signed INTEGER DEFAULT 0,
      nda_signed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id INTEGER NOT NULL,
      host_id INTEGER,
      location_id INTEGER,
      purpose TEXT,
      badge_number TEXT,
      qr_code TEXT,
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checked_out_at DATETIME,
      expected_checkout DATETIME,
      notes TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (visitor_id) REFERENCES visitors(id),
      FOREIGN KEY (host_id) REFERENCES hosts(id)
    );

    CREATE TABLE IF NOT EXISTS preregistrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_first_name TEXT NOT NULL,
      visitor_last_name TEXT NOT NULL,
      visitor_email TEXT,
      visitor_company TEXT,
      host_id INTEGER,
      location_id INTEGER,
      expected_date DATE NOT NULL,
      expected_time TIME,
      purpose TEXT,
      qr_code TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visit_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      document_type TEXT DEFAULT 'nda',
      signature_path TEXT,
      signed_at DATETIME,
      FOREIGN KEY (visit_id) REFERENCES visits(id)
    );

    CREATE TABLE IF NOT EXISTS visit_purposes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_locations (
      user_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, location_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    );
  `);
}

initializeDatabase();

// Seed default visit purposes if table is empty
const purposeCount = db.prepare('SELECT COUNT(*) as c FROM visit_purposes').get();
if (purposeCount.c === 0) {
  const insert = db.prepare('INSERT INTO visit_purposes (name, sort_order) VALUES (?, ?)');
  ['Besprechung', 'Lieferung', 'Interview', 'Wartung', 'Sonstiges'].forEach((name, i) => insert.run(name, i));
}

// Default system settings
const settingDefaults = {
  gdpr_retention_days: '365',
  visitor_email_confirmation: 'true',
  printer_enabled: 'false',
  printer_ip: '',
  printer_port: '9100',
  smtp_security: 'starttls',
  privacy_policy_text: 'Bitte fügen Sie hier den Text Ihrer Datenschutzerklärung ein (Einstellungen → Datenschutz).',
  privacy_policy_enabled: 'true',
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
Object.entries(settingDefaults).forEach(([k, v]) => insertSetting.run(k, v));

// Add abat_id to visitors if missing
const visitorsInfo0 = db.prepare("PRAGMA table_info(visitors)").all();
if (!visitorsInfo0.find(c => c.name === 'abat_id')) {
  db.exec('ALTER TABLE visitors ADD COLUMN abat_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_visitors_abat_id ON visitors(abat_id)');
  // Backfill existing visitors
  const existing = db.prepare('SELECT id FROM visitors').all();
  const updateAbatId = db.prepare('UPDATE visitors SET abat_id = ? WHERE id = ?');
  const checkAbatId = db.prepare('SELECT id FROM visitors WHERE abat_id = ?');
  for (const v of existing) {
    let id;
    do {
      id = 'ABAT-' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    } while (checkAbatId.get(id));
    updateAbatId.run(id, v.id);
  }
}

// Add columns to visits if missing
const visitsInfo = db.prepare("PRAGMA table_info(visits)").all();
if (!visitsInfo.find(c => c.name === 'privacy_policy_signed')) {
  db.exec('ALTER TABLE visits ADD COLUMN privacy_policy_signed INTEGER DEFAULT 0');
}
if (!visitsInfo.find(c => c.name === 'privacy_policy_signature_path')) {
  db.exec('ALTER TABLE visits ADD COLUMN privacy_policy_signature_path TEXT');
}
if (!visitsInfo.find(c => c.name === 'host_name_free')) {
  db.exec('ALTER TABLE visits ADD COLUMN host_name_free TEXT');
}

// Add group_id to preregistrations if missing
const preregInfo = db.prepare("PRAGMA table_info(preregistrations)").all();
if (!preregInfo.find(c => c.name === 'group_id')) {
  db.exec('ALTER TABLE preregistrations ADD COLUMN group_id TEXT');
}

// Add columns to hosts if missing
const hostsInfo = db.prepare("PRAGMA table_info(hosts)").all();
if (!hostsInfo.find(c => c.name === 'password_hash')) {
  db.exec('ALTER TABLE hosts ADD COLUMN password_hash TEXT');
}
if (!hostsInfo.find(c => c.name === 'ldap_dn')) {
  db.exec('ALTER TABLE hosts ADD COLUMN ldap_dn TEXT');
}
if (!hostsInfo.find(c => c.name === 'failed_login_attempts')) {
  db.exec('ALTER TABLE hosts ADD COLUMN failed_login_attempts INTEGER DEFAULT 0');
}
if (!hostsInfo.find(c => c.name === 'locked_until')) {
  db.exec('ALTER TABLE hosts ADD COLUMN locked_until DATETIME');
}

// Add lockout + 2FA columns to users if missing
const usersInfo = db.prepare("PRAGMA table_info(users)").all();
if (!usersInfo.find(c => c.name === 'failed_login_attempts')) {
  db.exec('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0');
}
if (!usersInfo.find(c => c.name === 'locked_until')) {
  db.exec('ALTER TABLE users ADD COLUMN locked_until DATETIME');
}

// Create initial admin user from env if no users exist yet
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const name     = process.env.ADMIN_NAME     || 'Administrator';
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(name, email, hash, 'superadmin');
  console.log(`[init] Admin-Benutzer erstellt: ${email}`);
}

// Remove watchlist table and blacklist columns if they still exist
db.exec('DROP TABLE IF EXISTS watchlist');
db.exec('DROP TABLE IF EXISTS parking_spots');
const visitorsInfoBl = db.prepare("PRAGMA table_info(visitors)").all();
if (visitorsInfoBl.find(c => c.name === 'blacklisted')) {
  db.exec('ALTER TABLE visitors DROP COLUMN blacklisted');
}
if (visitorsInfoBl.find(c => c.name === 'blacklist_reason')) {
  db.exec('ALTER TABLE visitors DROP COLUMN blacklist_reason');
}
const visitsInfoPark = db.prepare("PRAGMA table_info(visits)").all();
if (visitsInfoPark.find(c => c.name === 'license_plate')) {
  db.exec('ALTER TABLE visits DROP COLUMN license_plate');
}
if (visitsInfoPark.find(c => c.name === 'parking_spot')) {
  db.exec('ALTER TABLE visits DROP COLUMN parking_spot');
}
const preregInfoPark = db.prepare("PRAGMA table_info(preregistrations)").all();
if (preregInfoPark.find(c => c.name === 'license_plate')) {
  db.exec('ALTER TABLE preregistrations DROP COLUMN license_plate');
}

module.exports = db;
