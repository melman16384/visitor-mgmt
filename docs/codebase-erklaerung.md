# Codebase-Erklärung — Besucherverwaltungssystem

> Technische Tiefenanalyse mit Code-Snippets · Stand: Juni 2026

---

## Inhaltsverzeichnis

1. [Gesamtarchitektur im Überblick](#1-gesamtarchitektur-im-überblick)
2. [Backend-Einstiegspunkt (index.js)](#2-backend-einstiegspunkt-indexjs)
3. [Datenbank (database.js)](#3-datenbank-databasejs)
4. [Authentifizierung & Autorisierung](#4-authentifizierung--autorisierung)
5. [Check-in-Fluss — Wie ein Besucher eingecheckt wird](#5-check-in-fluss--wie-ein-besucher-eingecheckt-wird)
6. [Check-out-Fluss — drei Wege zum Auschecken](#6-check-out-fluss--drei-wege-zum-auschecken)
7. [Vorregistrierungen](#7-vorregistrierungen)
8. [Host-Portal — separates JWT-System](#8-host-portal--separates-jwt-system)
9. [Hintergrunddienste (Cron-Ersatz via setTimeout)](#9-hintergrunddienste-cron-ersatz-via-settimeout)
10. [Audit-Log — dateisbasiertes Compliance-System](#10-audit-log--dateibasiertes-compliance-system)
11. [E-Mail-System](#11-e-mail-system)
12. [Badge-Generierung (PDF)](#12-badge-generierung-pdf)
13. [Frontend-Architektur](#13-frontend-architektur)
14. [Axios-Client & JWT-Interceptor](#14-axios-client--jwt-interceptor)
15. [Auth-Context — globaler Zustand](#15-auth-context--globaler-zustand)
16. [Kiosk-System](#16-kiosk-system)
17. [i18n — Mehrsprachigkeit](#17-i18n--mehrsprachigkeit)
18. [QR-Scanner-Komponente](#18-qr-scanner-komponente)
19. [Standortbasierte Zugriffskontrolle](#19-standortbasierte-zugriffskontrolle)
20. [Datenbankmigrationen ohne Migrationstool](#20-datenbankmigrationen-ohne-migrationstool)

---

## 1. Gesamtarchitektur im Überblick

Das System besteht aus zwei komplett getrennten Node.js-Prozessen, die Nginx zusammenführt:

```
Browser / Kiosk-Tablet
        │
        ▼
  Cloudflare (HTTPS)
        │
        ▼
    Nginx :443
    ├── /       → /frontend/dist/   (React SPA, statisch)
    └── /api/   → localhost:3001    (Express.js Backend)
                        │
                        ├── better-sqlite3 → /backend/data/visitors.db
                        └── /logs/audit-YYYY-MM-DD.log
```

**Warum SQLite?** Das System ist Single-Tenant (eine Firma, ein Server). SQLite im WAL-Modus ist für diesen Anwendungsfall schneller als ein separater DB-Server, hat keine Netzwerklatenz und das Backup ist ein einfaches Dateikopieren.

**Warum kein separater Cron-Job?** Beide Hintergrunddienste (Auto-Checkout, Vorregistrierungs-Ablauf) laufen als `setTimeout` innerhalb des Node.js-Prozesses — keine externe Abhängigkeit, kein crontab, kein Systemdienst notwendig.

---

## 2. Backend-Einstiegspunkt (index.js)

`backend/src/index.js` — 127 Zeilen — ist der Kern des Backends. Er initialisiert in dieser Reihenfolge:

### Sicherheitsschicht

```js
// Sicherheits-HTTP-Header via helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false, // Wird von Nginx/Cloudflare übernommen
}));

// CORS: nur explizit erlaubte Origins können API-Calls machen
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
if (process.env.APP_URL) corsOrigins.push(process.env.APP_URL);
app.use(cors({ origin: corsOrigins, credentials: true }));
```

**Wichtig:** `APP_URL` aus `.env` wird dynamisch zur CORS-Whitelist hinzugefügt. Fehlt sie, funktioniert das Produktionssystem nicht — alle API-Calls werden blockiert.

### Upload-Zugriffsschutz

```js
// Fotos sind öffentlich (Admin-UI zeigt sie direkt an)
app.use('/uploads/photos', express.static(path.join(uploadsDir, 'photos')));

// Dokumente und Unterschriften erfordern ein gültiges Admin-JWT
app.use('/uploads/documents', authenticate, express.static(...));
app.use('/uploads/signatures', authenticate, express.static(...));
```

Die `authenticate`-Middleware (siehe Abschnitt 4) wird hier direkt als Express-Middleware eingesetzt — kein separater Route-Handler nötig.

### Rate-Limiting auf Login-Endpunkten

```js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 20,                   // max. 20 Versuche pro IP
  message: { error: 'Zu viele Anmeldeversuche...' },
});

app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/host-portal', loginLimiter, require('./routes/host-portal'));
```

### Startup-Sequenz

```js
require('./db/database');          // 1. Datenbank initialisieren & migrieren
auditCleanup();                    // 2. Alte Audit-Logs (>90 Tage) löschen
app.listen(PORT, () => {
  scheduleNext();                  // 3. Auto-Checkout planen
  scheduleExpiry();                // 4. Vorregistrierungs-Ablauf planen
});
```

Die Reihenfolge ist entscheidend: Die DB muss initialisiert sein, bevor die Dienste starten, weil beide Dienste DB-Abfragen machen.

---

## 3. Datenbank (database.js)

`backend/src/db/database.js` ist gleichzeitig Schema-Definition, Migrationsmanager und Seed-Loader.

### Initialisierung

```js
const db = new Database(path.resolve(dbPath));
db.pragma('journal_mode = WAL');    // Erlaubt gleichzeitige Reads + 1 Write
db.pragma('foreign_keys = ON');     // Referentielle Integrität erzwingen
```

WAL (Write-Ahead Logging) ist bei SQLite entscheidend für Concurrent-Access — mehrere Leseanfragen blockieren nicht mehr den Schreibvorgang.

### Tabellenstruktur

Alle Tabellen werden mit `CREATE TABLE IF NOT EXISTS` angelegt — idempotent, kein Fehler beim wiederholten Start:

```sql
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER NOT NULL,
  host_id    INTEGER,
  location_id INTEGER,
  purpose    TEXT,
  badge_number TEXT,
  qr_code    TEXT,
  checked_in_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  checked_out_at DATETIME,       -- NULL = noch aktiv
  status     TEXT DEFAULT 'active',  -- 'active' | 'completed'
  privacy_policy_signed INTEGER DEFAULT 0,
  privacy_policy_signature_path TEXT,
  FOREIGN KEY (visitor_id) REFERENCES visitors(id),
  FOREIGN KEY (host_id)    REFERENCES hosts(id)
);
```

**`visitors` vs. `visits`:** Das ist die wichtigste Designentscheidung. `visitors` enthält Stammdaten (Name, Firma, abat-ID) — **dauerhaft**. `visits` enthält jeden einzelnen Besuch — Check-in und Check-out. Ein Besucher kann viele Besuche haben.

### abat-ID: Automatische Generierung

```js
// Beim ersten Besucher-Insert:
let abatId;
do {
  abatId = 'ABAT-' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
} while (db.prepare('SELECT id FROM visitors WHERE abat_id = ?').get(abatId));
// do-while garantiert Einzigartigkeit: solange Kollision → neu würfeln
```

### Standard-Admin beim ersten Start

```js
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  // Nur wenn DB leer ist — wird nie wieder ausgeführt
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 12);
  db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(name, email, hash, 'superadmin');
}
```

---

## 4. Authentifizierung & Autorisierung

`backend/src/middleware/auth.js` — 33 Zeilen — enthält zwei Middleware-Funktionen:

### `authenticate` — JWT prüfen

```js
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Nicht autorisiert' });

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    // DB-Lookup: User noch aktiv? (Deaktivierte User werden so sofort ausgesperrt)
    const user = db.prepare(
      'SELECT id, name, email, role FROM users WHERE id = ? AND active = 1'
    ).get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });

    // Standort-IDs mitladen (für Filterung, siehe Abschnitt 19)
    const locationRows = db.prepare(
      'SELECT location_id FROM user_locations WHERE user_id = ?'
    ).all(user.id);
    user.location_ids = locationRows.map(r => r.location_id);

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}
```

**Wichtig:** Der User wird bei **jedem Request** aus der DB gelesen — nicht nur aus dem Token. Das bedeutet: Wenn ein Admin deaktiviert wird, ist er sofort ausgesperrt, obwohl sein Token noch 8h gültig wäre.

### `requireRole` — Rollenprüfung

```js
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht autorisiert' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Zugriff verweigert' });
    next();
  };
}

// Verwendung in einer Route:
router.delete('/:id', authenticate, requireRole(['superadmin']), (req, res) => { ... });
```

`requireRole` gibt eine Middleware-Funktion zurück (Higher-Order Function). So kann man flexibel mehrere Rollen erlauben: `requireRole(['superadmin', 'admin'])`.

### Login-Flow (auth.js)

```js
router.post('/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);

  if (!user) {
    log('LOGIN_FAILED', email, 'Benutzer nicht gefunden'); // Audit-Log
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    // Absichtlich generische Fehlermeldung — verhindert User-Enumeration
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    log('LOGIN_FAILED', email, 'Falsches Passwort');
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '8h' }
  );

  log('LOGIN', email, 'Admin-Login erfolgreich');

  const { password_hash, ...userWithoutHash } = user; // Hash NIE an Client senden
  res.json({ token, user: userWithoutHash });
});
```

---

## 5. Check-in-Fluss — Wie ein Besucher eingecheckt wird

Der Check-in-Endpunkt `POST /api/visitors` ist öffentlich (kein Auth erforderlich) — er wird vom Kiosk ohne Login aufgerufen.

### Ablauf im Backend (visitors.js)

```
Request: POST /api/visitors
  { first_name, last_name, email, company, host_id, purpose,
    location_id, signature_base64 }
         │
         ▼
1. Besucher suchen: erst per E-Mail, dann per Name (case-insensitive)
         │
         ├── Gefunden? → Daten aktualisieren (Telefon, Firma, NDA)
         └── Neu?      → abat-ID generieren + INSERT INTO visitors
         │
         ▼
2. Datenschutz-Unterschrift speichern (falls vorhanden)
   signature_base64 → Base64 dekodieren → PNG auf Disk
         │
         ▼
3. Badge-Nummer generieren: "B-" + letzte 5 Ziffern des Unix-Timestamps
         │
         ▼
4. INSERT INTO visits (status = 'active')
         │
         ▼
5. Async (fire-and-forget):
   ├── sendHostNotification() — E-Mail an Gastgeber
   └── sendVisitorConfirmation() — E-Mail an Besucher (wenn aktiviert)
         │
         ▼
6. log('CHECKIN', ...) — Audit-Log
         │
         ▼
7. Response: { visitor, visit }
```

### Besucher-Lookup: Deduplizierung

```js
let visitor = null;
if (email) {
  // Primär per E-Mail (eindeutig)
  visitor = db.prepare('SELECT * FROM visitors WHERE email = ?').get(email);
}
if (!visitor) {
  // Fallback: Name (case-insensitive)
  visitor = db.prepare(
    'SELECT * FROM visitors WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?)'
  ).get(first_name, last_name);
}
```

So wird derselbe Besucher bei mehreren Besuchen immer demselben `visitor`-Datensatz zugeordnet — die abat-ID bleibt dauerhaft gleich.

### Signatur speichern

```js
if (signature_base64) {
  const sigFilename = `privacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const base64Data = signature_base64.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(
    path.join(sigDir, sigFilename),
    Buffer.from(base64Data, 'base64')
  );
  signaturePath = sigFilename;
}
```

Der Dateiname kombiniert Timestamp + zufällige 6-Zeichen-Zeichenkette, um Kollisionen zu vermeiden.

---

## 6. Check-out-Fluss — drei Wege zum Auschecken

Das Backend unterstützt drei verschiedene Check-out-Methoden, alle in `visits.js`:

### Weg 1: Admin-Check-out (mit Auth)

```js
router.post('/:id/checkout', authenticate, (req, res) => {
  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  if (visit.status === 'completed')
    return res.status(400).json({ error: 'Bereits ausgecheckt' });

  db.prepare(`UPDATE visits SET checked_out_at = ?, status = 'completed' WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id);
});
```

### Weg 2: Kiosk per QR-Code (kein Auth)

```js
router.post('/checkout-by-qr', (req, res) => {
  const { qr_code } = req.body;

  // Sucht in BEIDEN Feldern: badge_number UND qr_code
  // badge_number = QR-Code vom gedruckten Etikett ("B-12345")
  // qr_code      = Vorregistrierungs-QR aus der E-Mail ("PRE-xxx-yyy")
  const visit = db.prepare(`
    SELECT v.*, vis.first_name, vis.last_name ...
    FROM visits v JOIN visitors vis ON vis.id = v.visitor_id
    WHERE (v.badge_number = ? OR v.qr_code = ?) AND v.status = 'active'
  `).get(qr_code, qr_code);

  if (!visit) return res.status(404).json({ error: 'Kein aktiver Besuch...' });

  db.prepare(`UPDATE visits SET checked_out_at = CURRENT_TIMESTAMP, status = 'completed' WHERE id = ?`)
    .run(visit.id);
});
```

**Wichtig:** Ein einziger Endpunkt akzeptiert zwei QR-Code-Typen. Der Kiosk sendet einfach was gescannt wurde — das Backend erkennt selbst, ob es ein Badge-QR oder ein Vorregistrierungs-QR ist.

### Weg 3: Kiosk per abat-ID (kein Auth)

```js
router.post('/checkout-by-abat-id', (req, res) => {
  const visit = db.prepare(`
    SELECT v.* FROM visits v
    JOIN visitors vis ON vis.id = v.visitor_id
    WHERE vis.abat_id = ? AND v.status = 'active'
    ORDER BY v.checked_in_at DESC LIMIT 1  -- neuester aktiver Besuch
  `).get(abat_id.toUpperCase());
  // .toUpperCase(): Benutzer tippt "abat-12345678" → wird zu "ABAT-12345678"
});
```

### Namenssuche für den Kiosk (kein Auth)

```js
router.get('/search-active', (req, res) => {
  const visits = db.prepare(`
    SELECT v.id, v.badge_number, v.checked_in_at,
           vis.first_name, vis.last_name, vis.company, h.name as host_name
    FROM visits v
    JOIN visitors vis ON vis.id = v.visitor_id
    LEFT JOIN hosts h ON h.id = v.host_id
    WHERE v.status = 'active'
    AND (vis.first_name || ' ' || vis.last_name LIKE ? OR vis.company LIKE ?)
    ORDER BY v.checked_in_at DESC LIMIT 10
  `).all(`%${q}%`, `%${q}%`);
});
```

SQLite-Stringkonkatenation `||` wird hier für die Volltextsuche über Vor- + Nachname genutzt.

---

## 7. Vorregistrierungen

`routes/preregistrations.js` implementiert mehrere öffentliche Endpunkte für den Kiosk.

### QR-Code-generierung und E-Mail-Versand (POST /)

```
Admin erstellt Vorregistrierung
    │
    ▼
Backend generiert eindeutigen QR-Code:
  crypto.randomBytes(16).toString('hex') → z.B. "PRE-a3f2e1..."
    │
    ▼
QR-Code als PNG-Buffer generieren (services/qrcode.js)
    │
    ▼
E-Mail an Besucher: QR-Code als CID-Anhang eingebettet
  + abat-ID als Fallback
  + Gastgebername + Datum + Standort mit Google-Maps-Link
    │
    ▼
INSERT INTO preregistrations (status = 'pending')
```

### Kiosk Check-in via QR-Code

```js
// Schritt 1: GET /qr/:qrcode — Vorregistrierungsdaten laden (Kiosk zeigt Bestätigungsscreen)
router.get('/qr/:qrcode', (req, res) => {
  const prereg = db.prepare(`
    SELECT p.*, h.name as host_name, l.name as location_name
    FROM preregistrations p
    LEFT JOIN hosts h ON p.host_id = h.id
    LEFT JOIN locations l ON p.location_id = l.id
    WHERE p.qr_code = ? AND p.status = 'pending'
  `).get(req.params.qrcode);
  // status = 'pending' → bereits eingecheckte oder stornierte Codes schlagen fehl
});

// Schritt 2: POST /qr/:qrcode/checkin — tatsächlich einchecken
router.post('/qr/:qrcode/checkin', async (req, res) => {
  // 1. Vorregistrierung laden (nochmals prüfen, ob noch pending)
  // 2. Visitor finden oder anlegen (getOrCreateVisitor)
  // 3. Kiosk-Korrekturen übernehmen (Besucher kann Name korrigieren)
  // 4. Datenschutz-Unterschrift speichern
  // 5. Visit anlegen: qr_code Feld wird mit dem Vorregistrierungs-QR befüllt
  // 6. Vorregistrierung → status = 'checked_in'
  // 7. Gastgeber per E-Mail benachrichtigen
});
```

### Ablauf-Management: getOrCreateVisitor

```js
function getOrCreateVisitor(email, firstName, lastName, company) {
  if (email) {
    const existing = db.prepare('SELECT * FROM visitors WHERE email = ?').get(email);
    if (existing) return existing; // Wiederkehrender Besucher: gleiche abat-ID
  }
  let abatId;
  do { abatId = generateAbatId(); }
  while (db.prepare('SELECT id FROM visitors WHERE abat_id = ?').get(abatId));

  const r = db.prepare(
    'INSERT INTO visitors (first_name, last_name, email, company, abat_id) VALUES (?, ?, ?, ?, ?)'
  ).run(firstName, lastName, email || null, company || null, abatId);
  return db.prepare('SELECT * FROM visitors WHERE id = ?').get(r.lastInsertRowid);
}
```

---

## 8. Host-Portal — separates JWT-System

Das Host-Portal verwendet ein vom Admin-System völlig getrenntes JWT, um Privilege-Escalation zu verhindern.

### Zwei verschiedene Token-Payloads

```js
// Admin-Token (auth.js):
jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: '8h' })
// Payload: { userId: 42, role: 'admin' }

// Host-Token (host-portal.js):
jwt.sign({ type: 'host', hostId: host.id }, secret, { expiresIn: '12h' })
// Payload: { type: 'host', hostId: 7 }
```

### Host-Middleware prüft explizit den Typ

```js
function authenticateHost(req, res, next) {
  const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'secret');

  // Ohne diese Prüfung könnte ein Admin-Token für das Host-Portal missbraucht werden
  if (payload.type !== 'host')
    return res.status(403).json({ error: 'Kein Host-Token' });

  const host = db.prepare('SELECT * FROM hosts WHERE id = ? AND active = 1').get(payload.hostId);
  if (!host) return res.status(401).json({ error: 'Gastgeber nicht gefunden' });
  req.host = host; // analog zu req.user beim Admin
  next();
}
```

### Host sieht nur seine eigenen Daten

```js
router.get('/visitors', authenticateHost, (req, res) => {
  // req.host.id ist garantiert — kein Besucher eines anderen Hosts sichtbar
  const upcoming = db.prepare(`
    SELECT p.* FROM preregistrations p
    WHERE p.host_id = ? AND p.status = 'pending'      -- NUR dieser Host
    ORDER BY p.expected_date ASC
  `).all(req.host.id);

  const active = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name ...
    FROM visits v JOIN visitors vi ON v.visitor_id = vi.id
    WHERE v.host_id = ? AND v.status = 'active'        -- NUR dieser Host
  `).all(req.host.id);
  ...
});
```

---

## 9. Hintergrunddienste (Cron-Ersatz via setTimeout)

Beide Dienste verwenden dasselbe Muster: `setTimeout` statt crontab.

### Auto-Checkout (services/auto-checkout.js)

```js
function getNextRunMs(timeStr) {
  const [h, m] = timeStr.split(':');
  const now = new Date();
  const target = new Date();
  target.setHours(parseInt(h), parseInt(m), 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // Wenn Uhrzeit heute schon vorbei → morgen
  return target - now; // Millisekunden bis zum nächsten Lauf
}

function scheduleNext() {
  const timeRow = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_checkout_time'").get();
  const delay = getNextRunMs(timeRow?.value || '19:00');

  setTimeout(() => {
    runAutoCheckout(); // Alle aktiven Visits auf 'completed' setzen
    scheduleNext();    // Rekursiv: plant sich selbst für den nächsten Tag
  }, delay);
}
```

### runAutoCheckout

```js
function runAutoCheckout() {
  const enabledRow = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_checkout_enabled'").get();
  if (enabledRow?.value !== 'true') return; // Respektiert Admin-Einstellung

  const result = db.prepare(`
    UPDATE visits SET checked_out_at = datetime('now', 'localtime'), status = 'completed'
    WHERE status = 'active'
  `).run();
  // datetime('now', 'localtime'): SQLite-Funktion für lokale Zeitzone (nicht UTC)

  if (result.changes > 0) {
    log('AUTO_CHECKOUT', 'System', `${result.changes} Besucher automatisch ausgecheckt`);
  }
}
```

### Vorregistrierungs-Ablauf (services/prereg-expiry.js)

```js
function runExpiry() {
  const today = new Date().toISOString().split('T')[0]; // "2026-06-19"
  const result = db.prepare(`
    UPDATE preregistrations
    SET status = 'expired'
    WHERE status = 'pending' AND expected_date < ?   -- Datum in der Vergangenheit
  `).run(today);
}

function scheduleExpiry() {
  runExpiry(); // Sofort beim Start → räumt Rückstände auf (z.B. nach Server-Neustart)

  function scheduleNext() {
    const now = new Date();
    const next = new Date();
    next.setHours(0, 5, 0, 0); // 00:05 Uhr
    if (next <= now) next.setDate(next.getDate() + 1);
    setTimeout(() => { runExpiry(); scheduleNext(); }, next - now);
  }
  scheduleNext();
}
```

---

## 10. Audit-Log — dateibasiertes Compliance-System

`services/audit-log.js` schreibt **eine Datei pro Tag** im JSON-Lines-Format:

```
/opt/visitor-mgmt/logs/
├── audit-2026-06-17.log
├── audit-2026-06-18.log
└── audit-2026-06-19.log
```

### Schreiben

```js
function log(action, actor, detail) {
  const entry = JSON.stringify({
    ts:     new Date().toISOString(), // "2026-06-19T10:23:45.123Z"
    action,                           // "CHECKIN" | "CHECKOUT" | "LOGIN" | ...
    actor,                            // E-Mail des Admins oder "System" oder "Kiosk/Empfang"
    detail                            // Beschreibung
  }) + '\n';
  fs.appendFileSync(logFilePath(todayStr()), entry, 'utf8');
  // appendFileSync: atomar genug für Single-Server (kein Race Condition bei synchronem Node)
}
```

Beispielzeile:
```json
{"ts":"2026-06-19T10:23:45.123Z","action":"CHECKIN","actor":"Kiosk/Empfang","detail":"Besucher: Max Mustermann"}
```

### Cleanup beim Serverstart

```js
function cleanup() {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 Tage in ms
  const files = fs.readdirSync(LOG_DIR);
  for (const file of files) {
    const match = file.match(/^audit-(\d{4}-\d{2}-\d{2})\.log$/);
    if (match && new Date(match[1]).getTime() < cutoff) {
      fs.unlinkSync(path.join(LOG_DIR, file));
    }
  }
}
```

### Protokollierte Ereignisse

| `action`                    | Wann                                    |
|-----------------------------|-----------------------------------------|
| `LOGIN`                     | Erfolgreicher Admin- oder Host-Login    |
| `LOGIN_FAILED`              | Fehlgeschlagener Login-Versuch          |
| `CHECKIN`                   | Besucher eingecheckt                    |
| `CHECKOUT`                  | Besucher ausgecheckt                    |
| `AUTO_CHECKOUT`             | Automatischer Checkout um konfigurierte Uhrzeit |
| `VORREGISTRIERUNG`          | Vorregistrierung erstellt               |
| `VORREGISTRIERUNG_GELÖSCHT` | Vorregistrierung dauerhaft gelöscht     |
| `VISITOR_GELÖSCHT`          | Besucher dauerhaft gelöscht (superadmin)|

---

## 11. E-Mail-System

`services/email.js` verwaltet drei E-Mail-Templates und einen konfigurierbaren SMTP-Transport.

### Transport-Factory

```js
function createTransport() {
  // Keine SMTP-Config → null → alle Mails werden nur in der Konsole geloggt (kein Absturz)
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your@email.com') return null;

  // smtp_security wird aus der DB gelesen (nicht aus .env) → änderbar ohne Neustart
  const secRow = db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_security'").get();
  const security = secRow?.value || process.env.SMTP_SECURITY || 'starttls';

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    ...getSecurityOptions(security), // { secure: true } für SSL, {} für STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
```

**Graceful Degradation:** Wenn kein SMTP konfiguriert ist, schlägt `createTransport()` nicht fehl — es gibt `null` zurück. Alle Send-Funktionen prüfen darauf und loggen dann nur in die Konsole.

### QR-Code-E-Mail (eingebettetes Bild via CID)

```js
await transport.sendMail({
  from: `"${company} Besucherverwaltung" <${process.env.FROM_EMAIL}>`,
  to: email,
  subject,
  html,
  attachments: [{
    filename: 'einlass-qrcode.png',
    content: qrBuffer,      // Buffer aus services/qrcode.js
    cid: 'qrcode@abat'     // Content-ID: im HTML referenziert als src="cid:qrcode@abat"
  }],
});
```

Im HTML-Template:
```html
<img src="cid:qrcode@abat" width="210" height="210" alt="QR-Code" />
```

CID-Einbettung stellt sicher, dass der QR-Code auch ohne Internetverbindung im E-Mail-Client angezeigt wird (keine externen URLs).

### Fire-and-Forget-Pattern

```js
// In visitors.js nach dem Check-in:
if (host) sendHostNotification(host, visitor, visit).catch(console.error);
// .catch() — Fehler beim E-Mail-Versand darf Check-in NICHT blockieren
```

E-Mail-Fehler werden geloggt, aber nie an den Client weitergegeben. Der Check-in ist bereits in der DB — der Besucher ist eingecheckt, egal ob die E-Mail ankommt.

---

## 12. Badge-Generierung (PDF)

`services/badge.js` erstellt ein A6-PDF (Querformat) mit PDFKit — alles rein programmatisch, kein HTML-zu-PDF.

```js
async function generateBadge({ visitorName, company, hostName, date, time, badgeNumber, qrBuffer }) {
  const doc = new PDFDocument({ size: 'A6', margin: 0, layout: 'landscape' });
  // A6 landscape = ~419 × 298 Punkte (1 Punkt = 1/72 Zoll)

  // Farbpalette aus abat CI:
  const BLUE  = '#004B87';  // Primärfarbe
  const LBLUE = '#00A3E0';  // Akzentfarbe

  // Linker Akzentstreifen (8pt breit, volle Höhe):
  doc.rect(0, 0, 8, H).fill(LBLUE);

  // Blauer Header-Bereich (52pt hoch):
  doc.rect(8, 0, W - 8, 52).fill(BLUE);
  doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold')
    .text('abat AG', 8 + PAD, 26);

  // QR-Code oben rechts einbetten (84×84 Punkte):
  if (qrBuffer) {
    doc.image(qrBuffer, W - QR - PAD, 58, { width: QR, height: QR });
  }

  // Besuchername groß (22pt):
  doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold')
    .text(visitorName, 8 + PAD, 62, { width: nameAreaW });

  doc.end(); // PDF fertigstellen → 'end'-Event → Buffer resolven
}
```

---

## 13. Frontend-Architektur

Das Frontend ist eine React 19 Single Page Application, gebaut mit Vite 8 + Tailwind CSS 4.

### Routing (App.jsx)

```jsx
// Geschützte Route: leitet zur Login-Seite weiter, wenn nicht eingeloggt
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Routing-Struktur:
<Routes>
  {/* Öffentlich — kein Login nötig */}
  <Route path="/login"          element={<Login />} />
  <Route path="/host/login"     element={<HostLogin />} />
  <Route path="/kiosk"          element={<KioskStart />} />
  <Route path="/kiosk/checkin"  element={<KioskCheckin />} />
  <Route path="/kiosk/checkout" element={<KioskCheckout />} />
  <Route path="/kiosk/manual"   element={<KioskManual />} />

  {/* Geschützt — Admin JWT erforderlich */}
  <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
  <Route path="/visitors"  element={<PrivateRoute><Layout><Visitors /></Layout></PrivateRoute>} />
  ...

  {/* 404 */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

`Layout` rendert die Sidebar + den oberen Header-Bereich. Kiosk-Routen haben kein Layout — sie laufen vollbildschirm ohne Navigation.

---

## 14. Axios-Client & JWT-Interceptor

`frontend/src/api/client.js` — 31 Zeilen — ist der zentrale HTTP-Client:

```js
const client = axios.create({
  baseURL: '/api',  // Nginx proxied /api/* → localhost:3001
  headers: { 'Content-Type': 'application/json' },
});

// Request-Interceptor: JWT automatisch anhängen
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response-Interceptor: 401 → automatischer Logout
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Kiosk-Routen NICHT weiterleiten (Kiosk hat kein Login)
      const path = window.location.pathname;
      if (!path.startsWith('/kiosk') && path !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

**Kiosk-Schutz:** Der 401-Redirect wird für `/kiosk*`-Routen explizit unterdrückt. Kiosk-Endpunkte sind public — ein 401-Fehler dort bedeutet einen Backend-Bug, keinen Session-Ablauf.

---

## 15. Auth-Context — globaler Zustand

`frontend/src/context/AuthContext.jsx` verwaltet den Login-Zustand der gesamten App:

```jsx
export function AuthProvider({ children }) {
  // Initialer State aus localStorage (Seite neu laden = weiterhin eingeloggt)
  const [user, setUser]   = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const login = useCallback(async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  // isAuthenticated: token UND user müssen vorhanden sein
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

// Zugriff in beliebiger Komponente:
const { user, isAuthenticated, logout } = useAuth();
```

---

## 16. Kiosk-System

Der Kiosk ist eine vollbildschirmoptimierte React-SPA für Touch-Tablets, ohne Login.

### KioskCheckin — Zustandsmaschine

Der Check-in-Flow läuft durch vier Zustände:

```
scan → confirm → privacy → success
                          ↗
           (privacy deaktiviert)
```

```jsx
const STATE_RANK = { scan: 0, confirm: 1, privacy: 2, success: 3, error: 3 };

// Zustandswechsel mit Richtungserkennung für CSS-Animation
const go = (newState) => {
  dirRef.current = (STATE_RANK[newState] ?? 0) >= (STATE_RANK[state] ?? 0)
    ? 'forward'   // Slide von rechts rein
    : 'back';     // Slide von links rein
  setAnimKey(k => k + 1); // neuer Key → React re-rendert mit Animation
  setState(newState);
};
```

### abat-ID-Eingabe im Kiosk

```jsx
function AbatIdInput({ onSubmit, loading, error }) {
  const [digits, setDigits] = useState('');

  const handleChange = (e) => {
    // Nur Ziffern erlaubt, max 8
    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
    setDigits(val);
    // Automatisch absenden bei 8 Ziffern — kein Button-Klick nötig
    if (val.length === 8) onSubmit('ABAT-' + val);
  };

  return (
    <div className="flex items-center border-2 ...">
      {/* "ABAT-" ist fest — Benutzer tippt nur die 8 Ziffern */}
      <span className="bg-gray-100 px-4 ... font-mono font-bold select-none">ABAT-</span>
      <input type="text" inputMode="numeric" pattern="[0-9]*" ... onChange={handleChange} />
    </div>
  );
}
```

`inputMode="numeric"` öffnet auf iOS/Android die numerische Tastatur — optimal für Touch-Kioske.

### Automatischer Rücksprung nach Erfolg

```jsx
useEffect(() => {
  if (state === 'success' || state === 'error') {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); navigate('/kiosk'); }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer); // Cleanup bei unmount
  }
}, [state, navigate]);
```

Nach 6 Sekunden kehrt der Kiosk automatisch zum Startbildschirm zurück.

---

## 17. i18n — Mehrsprachigkeit

Das System hat **zwei unabhängige i18n-Systeme**:

### Admin-Panel: react-i18next (DE / EN / LT / RU)

```js
// frontend/src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './de';
import en from './en';
// ...

i18n.use(initReactI18next).init({
  lng: localStorage.getItem('admin_lang') || 'de',
  resources: {
    de: { translation: de },
    en: { translation: en },
    lt: { translation: lt },
    ru: { translation: ru },
  },
  interpolation: { escapeValue: false },
});
```

Verwendung in Komponenten:
```jsx
const { t } = useTranslation();
<button>{t('common.save')}</button>       // "Speichern" / "Save" / "Išsaugoti" / "Сохранить"
<span>{t('visitors.tabs.active')}</span>  // "Aktiv" / "Active" / ...
```

### Kiosk: Eigenes Context-System (DE / EN)

```jsx
// KioskLangContext.jsx — kein i18next, simples Key-Value-Objekt
const T = {
  de: { checkin: 'Einchecken', checkout: 'Auschecken', ... },
  en: { checkin: 'Check In',   checkout: 'Check Out',  ... },
};

export function KioskLangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('kiosk_lang') || 'de');

  const t = (key) => T[lang]?.[key] ?? T.de[key] ?? key;
  // Fallback-Kette: aktuelle Sprache → Deutsch → Key selbst

  const setLang = (l) => {
    localStorage.setItem('kiosk_lang', l);
    setLangState(l);
  };

  return <KioskLangContext.Provider value={{ lang, t, setLang }}>{children}</KioskLangContext.Provider>;
}
```

**Warum zwei Systeme?** Der Kiosk ist komplett eigenständig (kein Login, anderes UX), hat weniger Texte und der Admin kann eine andere Sprache wählen als der Kiosk-Standort anzeigt — Deutsch im Admin, Englisch für internationale Besucher am Kiosk.

---

## 18. QR-Scanner-Komponente

`frontend/src/components/QRScanner.jsx` — 87 Zeilen — kapselt `html5-qrcode`:

```jsx
export default function QRScanner({ onScan, onError }) {
  const [active, setActive] = useState(false);
  const scannerRef = useRef(null);
  const stoppedRef = useRef(false); // WICHTIG: verhindert Doppel-stop()

  useEffect(() => {
    if (!active) return;
    stoppedRef.current = false;

    const scanner = new Html5Qrcode(containerIdRef.current);
    scannerRef.current = scanner;

    // safeStop: stellt sicher, dass stop() nur EINMAL aufgerufen wird
    // html5-qrcode wirft Fehler bei doppeltem stop() → weißer Bildschirm
    const safeStop = () => {
      if (stoppedRef.current) return;  // Guard: schon gestoppt?
      stoppedRef.current = true;
      try { scanner.stop().catch(() => {}); } catch {}
    };

    // Erst Front-Kamera (für Kiosk-Tablets, die dem Besucher zugewandt sind),
    // Fallback: Rückkamera (Environment)
    startWithFacing('user').catch(() =>
      startWithFacing('environment').catch(() => {
        setError('Kamera konnte nicht gestartet werden.');
        setActive(false);
      })
    );

    return () => { safeStop(); }; // Cleanup beim unmount
  }, [active]);
}
```

Der `stoppedRef`-Guard ist kritisch: Ohne ihn kann `stop()` zweimal aufgerufen werden (einmal von `onScan` und einmal vom React-Cleanup), was `html5-qrcode` mit einem Fehler quittiert der den gesamten Bildschirm leer macht.

---

## 19. Standortbasierte Zugriffskontrolle

Receptionist-Benutzer können auf bestimmte Standorte beschränkt werden. Die Filterung erfolgt auf DB-Ebene.

### Datenmodell

```sql
-- user_locations: many-to-many
-- user_id=5, location_id=2 → User 5 sieht nur Standort 2
-- Kein Eintrag in user_locations → User sieht alle Standorte
CREATE TABLE user_locations (
  user_id     INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, location_id),
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);
```

### Auth-Middleware lädt location_ids mit

```js
// In authenticate() — bei JEDEM Request:
const locationRows = db.prepare(
  'SELECT location_id FROM user_locations WHERE user_id = ?'
).all(user.id);
user.location_ids = locationRows.map(r => r.location_id);
// req.user.location_ids = [2, 4] oder [] (= alle sehen)
```

### Filter-Helper-Funktion in visitors.js

```js
function locationFilter(user, tableAlias = 'v') {
  const ids = user?.location_ids;
  if (!ids || ids.length === 0) return { sql: '', params: [] }; // Keine Einschränkung

  const placeholders = ids.map(() => '?').join(','); // "?,?,?"
  return {
    sql: `AND ${tableAlias}.location_id IN (${placeholders})`,
    params: ids,
  };
}

// Verwendung:
const { sql: locSql, params: locParams } = locationFilter(req.user);
const rows = db.prepare(`
  SELECT vi.* FROM visitors vi
  JOIN visits v ON vi.id = v.visitor_id
  WHERE v.status = 'active' ${locSql}   -- locSql ist "" oder "AND v.location_id IN (?)"
`).all(...locParams);
```

---

## 20. Datenbankmigrationen ohne Migrationstool

Da kein Migrationstool (Flyway, Knex migrations etc.) eingesetzt wird, werden Schema-Änderungen direkt in `database.js` über `PRAGMA table_info` erkannt und nachgezogen:

```js
// Prüfen ob Spalte existiert, ggf. hinzufügen:
const visitsInfo = db.prepare("PRAGMA table_info(visits)").all();
// visitsInfo = [{ cid: 0, name: 'id', type: 'INTEGER', ... }, ...]

if (!visitsInfo.find(c => c.name === 'privacy_policy_signed')) {
  db.exec('ALTER TABLE visits ADD COLUMN privacy_policy_signed INTEGER DEFAULT 0');
}
if (!visitsInfo.find(c => c.name === 'privacy_policy_signature_path')) {
  db.exec('ALTER TABLE visits ADD COLUMN privacy_policy_signature_path TEXT');
}
```

### Bereinigung alter Features

Entfernte Features (Watchlist, Parkplatz, Blacklist) werden beim Start aktiv entfernt, falls sie noch existieren:

```js
db.exec('DROP TABLE IF EXISTS watchlist');
db.exec('DROP TABLE IF EXISTS parking_spots');

const visitorsInfo = db.prepare("PRAGMA table_info(visitors)").all();
if (visitorsInfo.find(c => c.name === 'blacklisted')) {
  db.exec('ALTER TABLE visitors DROP COLUMN blacklisted');
}
```

Das macht den Code selbst zum einzigen Source-of-Truth — egal auf welchem Stand die DB-Datei ist, nach dem Start ist sie immer im korrekten Schema.

---

## Zusammenfassung: Wichtige Design-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| SQLite statt PostgreSQL | Single-Tenant, kein Netzwerk-Overhead, Backup = cp |
| WAL-Modus | Concurrent Reads ohne Schreibblockade |
| `setTimeout` statt Cron | Keine externe Abhängigkeit, konfigurierbar über Admin-UI |
| Kein Migrations-Tool | PRAGMA table_info-Checks sind für ein wachsendes Single-Server-Projekt ausreichend |
| Zwei JWT-Systeme | Admin und Host dürfen nie dieselben Endpunkte nutzen |
| Fire-and-forget E-Mails | E-Mail-Fehler dürfen Check-in nicht blockieren |
| CID-Einbettung für QR | QR-Code ist auch ohne Internet im Mail-Client sichtbar |
| `stoppedRef`-Guard im QR-Scanner | html5-qrcode-Bug: doppeltes stop() → weißer Bildschirm |
| Kiosk ohne i18next | Eigenständiges Context-System, einfacher, weniger Dependencies |
| `active=1`-Check bei JWT-Verify | Deaktivierte User sofort sperren, nicht erst bei Token-Ablauf |
| Generische Login-Fehlermeldung | Verhindert User-Enumeration durch Angreifer |
