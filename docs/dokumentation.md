# Besucherverwaltungssystem — Projektdokumentation

> Erstellt: 15. Juni 2026 | Zuletzt aktualisiert: 15. Juli 2026 (Rev. 5)  
> Kunde: **abat AG**  
> Domain: https://visitor.luwilab.work  
> Server: /opt/visitor-mgmt

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Corporate Identity — abat AG](#2-corporate-identity--abat-ag)
3. [Systemarchitektur](#3-systemarchitektur)
4. [Verzeichnisstruktur](#4-verzeichnisstruktur)
5. [Datenbank](#5-datenbank)
6. [Backend API](#6-backend-api)
7. [Frontend & Seiten](#7-frontend--seiten)
8. [Kiosk-System](#8-kiosk-system)
9. [Mehrsprachigkeit (i18n)](#9-mehrsprachigkeit-i18n)
10. [abat-ID](#10-abat-id)
11. [Dokumenten-Upload & Unterschrift](#11-dokumenten-upload--unterschrift)
12. [Zugangsdaten & Benutzerrollen](#12-zugangsdaten--benutzerrollen)
    - 12a. [Standortbasierte Zugriffskontrolle](#12a-standortbasierte-zugriffskontrolle)
13. [Check-in am Empfang (Dashboard/Visitors)](#13-check-in-am-empfang-dashboardvisitors)
14. [E-Mail-System](#14-e-mail-system)
15. [Auto-Checkout](#15-auto-checkout)
    - 15a. [Vorregistrierungs-Ablauf (Expiry-Job)](#15a-vorregistrierungs-ablauf-expiry-job)
    - 15b. [Gastgeber-Synchronisierung (AD-Sync)](#15b-gastgeber-synchronisierung-ad-sync)
16. [Host-Portal](#16-host-portal)
17. [Audit-Log & Compliance](#17-audit-log--compliance)
18. [Sicherheit](#18-sicherheit)
19. [GDPR & Datenschutz](#19-gdpr--datenschutz)
20. [Infrastruktur & Deployment](#20-infrastruktur--deployment)
21. [SSL & Cloudflare](#21-ssl--cloudflare)
22. [Umgebungsvariablen (.env)](#22-umgebungsvariablen-env)
23. [Wichtige Befehle](#23-wichtige-befehle)
24. [Fehlerbehebung](#24-fehlerbehebung)
25. [Netzwerk & Firewall-Freigaben](#25-netzwerk--firewall-freigaben)

---

## 1. Projektübersicht

Ein vollständiges, webbasiertes Besucherverwaltungssystem für Unternehmen. Besucher können am Empfang oder per Kiosk-Modus ein- und ausgecheckt werden. Das System unterstützt Vorregistrierungen, PDF-Badge-Generierung, Evakuierungslisten, Berichte, standortbasierte Zugriffskontrolle, ein mobiloptimiertes Gastgeber-Portal sowie ein Audit-Log für Compliance-Anforderungen.

### Features im Überblick

| Feature | Beschreibung |
|---|---|
| Check-in / Check-out | Walk-in, Kamera-QR-Scan oder Vorregistrierung; auch manuell im Dashboard |
| Vorregistrierung | Gastgeber kann Besucher voranmelden, QR-Code per E-Mail; Gruppenregistrierung |
| QR-Code Vorregistrierung | Server-seitig generiert (kein externer Dienst), Anzeige im Admin-Modal |
| Badge-Generierung | A6-PDF (Landscape) mit Name, Firma, Gastgeber, QR-Code — downloadbar. Keine Badge-Nummer mehr sichtbar (siehe [6.](#6-backend-api)) |
| abat-ID | Permanente Besucher-ID im Format `ABAT-########`; in E-Mail + Kiosk-Erfolgsscreen |
| Kiosk-Modus | 2 Optionen: Einchecken, Auschecken — kein Login nötig |
| Kiosk Check-in Flow | Mehrstufig: QR-Scan oder abat-ID → Daten bestätigen → Datenschutz unterschreiben → Erfolg |
| Datenschutzerklärung | Unterschrift am Kiosk mit Finger/Stift (signature_pad); Text konfigurierbar im Admin |
| Mehrsprachiger Kiosk | Deutsch / Englisch, umschaltbar per Sprachbutton |
| Kamera-QR-Scanner | Echter Kamera-Scan; robuster Stop-Guard verhindert Doppel-Stop-Fehler |
| Dokumenten-Upload | PDF/DOC hochladen + digitale Unterschrift (Canvas) |
| Evakuierungsliste | Echtzeit, nach Standort gruppiert, druckoptimiert, 30 s Auto-Refresh |
| Berichte & Export | Tages-/Monatsberichte, CSV-Export |
| E-Mail-Benachrichtigungen | Gastgeber bei Ankunft, Besucher Check-in-Bestätigung, QR-Code bei Vorregistrierung |
| SMTP-Verschlüsselung | STARTTLS / SSL/TLS / Keine — konfigurierbar im Admin |
| Mehrere Standorte | Unterstützung für mehrere Firmenstandorte |
| Standortbasierte Zugriffskontrolle | Empfang-Benutzer können auf bestimmte Standorte beschränkt werden |
| Benutzerverwaltung | Anlegen, Bearbeiten, Deaktivieren, Entsperren und endgültiges Löschen von Benutzern im Admin (nur `admin`) |
| Besuchsgrundauswahl | Konfigurierbare Besuchszwecke im Admin |
| Auto-Checkout | Automatisches Auschecken aller aktiven Besucher täglich um 19:00 Uhr (konfigurierbar) |
| Vorregistrierungs-Ablauf | Abgelaufene Vorregistrierungen werden täglich um 00:05 Uhr automatisch auf `expired` gesetzt |
| Host-Portal | Gastgeber können sich separat einloggen; mobiloptimiert (Karten + Bottom-Navigation); Ansicht: Angekündigt / Anwesend / Vergangen; eigenes Passwort ändern |
| Audit-Log | 90 Tage Aufbewahrung, Tagesprotokoll-Download, Compliance-Bericht als CSV |
| Admin-Löschrechte | Besucher, Vorregistrierungen und (deaktivierte) Benutzer dauerhaft aus der Datenbank entfernen |
| Rollenverwaltung | admin / receptionist / host (Rolle `superadmin` wurde entfernt — bestehende superadmin-Konten wurden beim Upgrade automatisch zu `admin`, siehe [12.](#12-zugangsdaten--benutzerrollen)) |
| **Zwei-Faktor-Authentifizierung (2FA)** | TOTP-basiert (Authenticator-App), **verpflichtend für alle `admin`-Konten** — erzwungene Einrichtung direkt nach Login, Backup-Codes, Account-Sperre nach 5 Fehlversuchen (15 Min.) |
| **Gastgeber-Synchronisierung (AD-Sync)** | Gastgeber automatisch aus Active Directory/LDAP übernehmen; täglicher Sync um 03:00 Uhr oder manuell auslösbar (nur `admin`) |
| GDPR-Datenlöschung | Automatische Anonymisierung nach konfigurierbaren Tagen |
| abat AG CI | Logo, Mulish-Schrift, Markenfarben durchgängig |
| Automatisches DB-Backup | Tägliches SQLite-Backup um 03:00 Uhr via systemd Timer; 30 Tage Aufbewahrung |
| Besuchszweck-Sortierung | Reihenfolge per Drag & Drop im Admin anpassbar |
| **Mehrsprachigkeit (i18n)** | Admin-Panel in DE / EN; Sprachumschalter in der Sidebar; Kiosk hat eigenes i18n-System (DE/EN) |
| Microsoft SSO (Host-Portal) | Vorbereitet, aktuell **nicht funktionsfähig ohne Zusatzarbeit** — siehe Hinweis in [16.](#16-host-portal) |

---

## 2. Corporate Identity — abat AG

Das System ist vollständig auf die CI der abat AG ausgerichtet.

### Logos

| Datei (Quelle) | Verwendung | Eingebunden als |
|---|---|---|
| `abat-Logo-Dunkelgrau_bigger.png` | Login-Seite, Admin-Bereich (heller Hintergrund) | `/public/logo-dark.png` |
| `abat-Logo-Hellgrau.png` | Kiosk-Header, Sidebar (dunkler Hintergrund) | `/public/logo-light.png` |

### Schriftart: Mulish

Variable Font (100–900 Gewicht), liegt lokal auf dem Server — keine externe CDN-Abhängigkeit.

### Farbpalette

| Name | HEX | Verwendung |
|---|---|---|
| **Blau** | `#004B87` | Primäre Buttons, aktive Navigation, Badge-Header |
| Hellblau | `#00A3E0` | Hover-Akzente, Badge-Akzentstreifen |
| Lichtblau | `#9ADBE8` | Hintergründe, Badge-Untertitel |
| Dunkelgrau | `#53565A` | Fließtext, Überschriften, Sidebar |
| Hellgrau | `#C8C9C7` | Rahmen, Trennlinien |
| Metallic | `#8D9093` | Untertexte, Platzhalter |

---

## 3. Systemarchitektur

```
Internet
   │
   ▼
Cloudflare Proxy (SSL-Terminierung zum User)
   │  HTTPS (443)
   ▼
Nginx (Reverse Proxy)
   ├── /           → /opt/visitor-mgmt/frontend/dist  (React SPA)
   └── /api/       → http://127.0.0.1:3001            (Node.js Backend)

Node.js Backend (Port 3001)
   ├── better-sqlite3 → /opt/visitor-mgmt/backend/data/visitors.db
   └── Logs           → /opt/visitor-mgmt/logs/audit-YYYY-MM-DD.log
```

**Tech Stack:**
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4 + Mulish Font + react-i18next (i18n)
- **Backend:** Node.js (≥ 20, getestet auf 24) + Express.js 5
- **Datenbank:** SQLite (better-sqlite3 12, WAL-Modus)
- **Auth:** JWT (JSON Web Tokens) — Admin-Token: 8h, Host-Token: 12h; TOTP-2FA via otplib (verpflichtend für `admin`)
- **Sicherheit:** helmet (HTTP-Header), express-rate-limit (Brute-Force-Schutz), bcryptjs (cost 12), Account-Lockout (5 Fehlversuche → 15 Min. Sperre)
- **Verzeichnisdienst:** ldapts (Active-Directory-Sync für Gastgeber, siehe [Abschnitt 15b](#15b-gastgeber-synchronisierung-ad-sync))
- **PDF:** PDFKit (Badge-Generierung A6 Landscape)
- **QR-Codes:** qrcode (Generierung) + html5-qrcode (Kamera-Scanner)
- **Unterschrift:** signature_pad (Canvas-basiert)
- **Datei-Upload:** multer 2 (Fotos + Dokumente)
- **E-Mail:** Nodemailer (SMTP, STARTTLS/SSL/Keine konfigurierbar)
- **Webserver:** Nginx 1.24
- **SSL:** Cloudflare Origin Certificate (gültig bis 2041)
- **Prozessmanager:** pm2 (Prozessname `visitor-mgmt`)

> **Hinweis Major-Upgrade (Juni 2026):** React 18→19, Express 4→5, Tailwind 3→4, Vite 5→8,
> better-sqlite3 9→12, multer 1→2. Der Sprung auf better-sqlite3 12 war nötig, da ältere
> Versionen unter Node.js 24 nicht mehr kompilieren (C++20-Anforderung). Bei Express 5 wurde in
> `host-portal.js` `req.host` → `req.portalHost` umbenannt (Kollision mit eingebautem Getter).

---

## 4. Verzeichnisstruktur

```
/opt/visitor-mgmt/
│
├── backup.sh                        # SQLite-Backup-Skript (via systemd timer)
├── backups/                         # Tägliche Backups visitors-YYYY-MM-DD.db (30 Tage)
│
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js          # SQLite-Initialisierung & Schema
│   │   │   └── seed.js              # Testdaten
│   │   ├── middleware/
│   │   │   └── auth.js              # JWT-Middleware, requireRole(), location_ids laden
│   │   ├── routes/
│   │   │   ├── auth.js              # Login (inkl. 2FA-Zwischenschritt), /me, Passwort ändern, 2FA-Setup/Verify/Disable
│   │   │   ├── ad-sync.js           # AD-Sync: Konfiguration, Status, manueller Sync-Trigger (admin)
│   │   │   ├── audit-log.js         # Audit-Log: Dateiliste, Download, Compliance-Bericht
│   │   │   ├── dashboard.js         # Stats, Chart-Daten, Recent visits
│   │   │   ├── documents.js         # Dokument-Upload + Unterschrift
│   │   │   ├── host-portal.js       # Host-Portal: Login, Besucher, Vorregistrierungen, Passwort ändern, MS-SSO-Redirect
│   │   │   ├── hosts.js             # CRUD Gastgeber (GET public, ohne password_hash)
│   │   │   ├── locations.js         # CRUD Standorte (inkl. Land, Zeitzone, Vor-Ort-Kontakt)
│   │   │   ├── preregistrations.js  # Vorregistrierung + Batch + QR-Versand
│   │   │   ├── reports.js           # Berichte, Evakuierung, CSV (standort-/rollengefiltert)
│   │   │   ├── settings.js          # System-Settings, GDPR-Cleanup, E-Mail-Test
│   │   │   ├── users.js             # CRUD Benutzer + Standortzuweisung, Unlock, 2FA-Reset (admin)
│   │   │   ├── visit-purposes.js    # CRUD + Reorder Besuchszwecke (GET public)
│   │   │   ├── visitors.js          # CRUD Besucher + Check-in (standortgefiltert)
│   │   │   └── visits.js            # Check-out, Checkout per QR (badge_number ODER qr_code)
│   │   ├── services/
│   │   │   ├── ad-sync.js           # LDAP-Bind + Suche, Hosts anlegen/aktualisieren/deaktivieren (ldapts)
│   │   │   ├── ad-sync-schedule.js  # Täglicher AD-Sync um 03:00 Uhr per setTimeout
│   │   │   ├── audit-log.js         # Log-Schreiben, Cleanup (90 Tage), Dateiliste
│   │   │   ├── auto-checkout.js     # Täglicher Auto-Checkout per setTimeout
│   │   │   ├── badge.js             # PDF-Badge Generierung (PDFKit, A6 Landscape) — ohne Badge-Nummer
│   │   │   ├── email.js             # Nodemailer: alle ausgehenden Mails
│   │   │   ├── label-printer.js     # Etikettendrucker-Rendering — Code vorhanden, aber in keiner Route mehr verdrahtet (siehe [1.](#1-projektübersicht))
│   │   │   ├── prereg-expiry.js     # Tägliche Markierung abgelaufener Vorregistrierungen
│   │   │   ├── qrcode.js            # QR-Code als Buffer oder DataURL
│   │   │   └── totp.js              # TOTP-Secret/-Verify, Backup-Codes (otplib + bcrypt)
│   │   └── index.js                 # Express App, Port 3001
│   ├── data/
│   │   └── visitors.db              # SQLite-Datenbank (NICHT löschen!)
│   ├── uploads/
│   │   ├── documents/               # Hochgeladene Dokumente (PDF/DOC) — auth-geschützt
│   │   └── signatures/              # Unterschriften als PNG — auth-geschützt
│   ├── .env                         # Produktionskonfiguration
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   ├── logo-dark.png
│   │   ├── logo-light.png
│   │   └── fonts/
│   ├── src/
│   │   ├── api/client.js            # Axios-Instanz, 401-Redirect (kiosk-aware)
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx          # Navigation + LangSwitcher (Sprachumschalter DE/EN)
│   │   │   ├── Modal.jsx
│   │   │   ├── QRScanner.jsx
│   │   │   ├── KioskHeader.jsx      # Wiederverwendbarer Kiosk-Header (Zurück, Logo, Sprachumschalter)
│   │   │   ├── SignaturePad.jsx
│   │   │   └── DocumentSigning.jsx
│   │   ├── i18n/
│   │   │   ├── index.js             # i18next-Initialisierung (DE/EN, localStorage-Persistenz)
│   │   │   ├── de.js                # Deutsch (Referenz-Datei)
│   │   │   └── en.js                # Englisch
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── KioskLangContext.jsx  # DE/EN Übersetzungen für Kiosk (separat von Admin-i18n)
│   │   └── pages/
│   │       ├── AuditLog.jsx         # Audit-Log & Compliance (admin)
│   │       ├── Dashboard.jsx
│   │       ├── Evacuation.jsx       # Nach Standort gruppiert, druckoptimiert
│   │       ├── HostLogin.jsx        # Gastgeber-Portal Login (kein Admin-Zugang)
│   │       ├── HostPortal.jsx       # Gastgeber-Portal (Besucher + Vorregistrierung)
│   │       ├── Hosts.jsx
│   │       ├── KioskCheckin.jsx
│   │       ├── KioskCheckout.jsx
│   │       ├── KioskManual.jsx
│   │       ├── KioskStart.jsx       # Mit Sprachschalter DE/EN
│   │       ├── Login.jsx            # Passwort-Login + zweiter Schritt für 2FA-Code/Backup-Code
│   │       ├── NotFound.jsx         # 404-Fehlerseite
│   │       ├── PreRegistration.jsx  # Mit Gruppenregistrierung
│   │       ├── Reports.jsx
│   │       ├── Settings.jsx         # inkl. Tab "Gastgeber-Sync" (AD-Sync) und 2FA-Verwaltung im Passwort-Tab
│   │       ├── TwoFactorSetup.jsx   # Erzwungene 2FA-Einrichtung (QR-Code + Backup-Codes) für Admins ohne aktives 2FA
│   │       └── Visitors.jsx         # Tabs: Alle / Angekündigt / Aktiv / Verlassen; Check-in-Formular (VisitorCheckinForm) hier statt im Dashboard
│   ├── dist/                        # Produktions-Build
│   └── package.json
│
└── logs/
    └── audit-YYYY-MM-DD.log         # Tägliche Audit-Protokolle (90 Tage Aufbewahrung)
```

---

## 5. Datenbank

**Datei:** `/opt/visitor-mgmt/backend/data/visitors.db`  
**Engine:** SQLite mit WAL-Modus und Foreign Key Enforcement

### Tabellen

#### `users` — Systembenutzer
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Anzeigename |
| email | TEXT UNIQUE | Login-E-Mail |
| password_hash | TEXT | bcrypt Hash (cost 12) |
| role | TEXT | `admin` / `receptionist` (Rolle `superadmin` entfernt, siehe [12.](#12-zugangsdaten--benutzerrollen)) |
| active | INTEGER | 1 = aktiv, 0 = deaktiviert |
| failed_login_attempts | INTEGER | Zähler für Account-Lockout, 0 nach erfolgreichem Login |
| locked_until | DATETIME | Gesetzt nach 5 Fehlversuchen (15 Min. Sperre), sonst NULL |
| totp_secret | TEXT | Base32-Secret für TOTP, NULL solange 2FA nicht eingerichtet |
| totp_enabled | INTEGER | 1 = 2FA aktiv und beim Login erforderlich |
| totp_backup_codes | TEXT | JSON-Array bcrypt-gehashter Einmal-Backup-Codes |
| created_at | DATETIME | |

#### `user_locations` — Standortzuweisung für Benutzer (many-to-many)
| Spalte | Typ | Beschreibung |
|---|---|---|
| user_id | INTEGER PK | FK → users (CASCADE DELETE) |
| location_id | INTEGER PK | FK → locations (CASCADE DELETE) |

> Kein Eintrag = Benutzer sieht alle Standorte.

#### `locations` — Standorte
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | z.B. "Bremen", "Heidelberg" |
| address | TEXT | Straße & Hausnummer |
| city | TEXT | Stadt |
| country | TEXT | Land (Freitext) |
| timezone | TEXT | IANA-Zeitzone, Standard `Europe/Berlin` |
| contact_name | TEXT | Ansprechpartner vor Ort |
| contact_email | TEXT | |
| contact_phone | TEXT | |
| active | INTEGER | |

#### `hosts` — Gastgeber
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| email | TEXT | Für Benachrichtigungen und Portal-Login |
| phone | TEXT | |
| department | TEXT | Abteilung |
| location_id | INTEGER | FK → locations |
| password_hash | TEXT | bcrypt Hash (cost 12) — nur wenn Host-Portal aktiviert |
| ldap_dn | TEXT | Distinguished Name aus Active Directory — gesetzt, wenn der Gastgeber per AD-Sync angelegt/aktualisiert wurde (siehe [15b.](#15b-gastgeber-synchronisierung-ad-sync)) |
| failed_login_attempts | INTEGER | Account-Lockout-Zähler für das Host-Portal-Login |
| locked_until | DATETIME | Sperrzeitpunkt nach zu vielen Fehlversuchen |
| active | INTEGER | Soft-Delete (auch durch AD-Sync gesetzt, wenn der AD-Account verschwindet) |

> `password_hash` wird **nicht** über die öffentliche API zurückgegeben.

#### `visitors` — Besucherstammdaten
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| abat_id | TEXT UNIQUE | Permanente Besucher-ID, Format `ABAT-########` |
| first_name | TEXT | |
| last_name | TEXT | |
| email | TEXT | |
| company | TEXT | |
| nda_signed | INTEGER | 0 / 1 — in der UI mittlerweile als "Datenschutzerklärung unterschrieben" beschriftet (Spaltenname unverändert) |
| nda_signed_at | DATETIME | |
| created_at | DATETIME | |

> **Entfernt:** die Spalte `phone` wurde aus `visitors` gestrichen (Check-in-Formular hat kein Telefonfeld mehr) — die Migration löscht die Spalte beim nächsten Serverstart automatisch, falls sie noch existiert.

#### `visits` — Einzelne Besuche
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_id | INTEGER | FK → visitors |
| host_id | INTEGER | FK → hosts |
| host_name_free | TEXT | Freitext-Gastgebername, wenn kein `host_id` gewählt wurde (Kiosk-Walk-in) |
| location_id | INTEGER | FK → locations |
| purpose | TEXT | Besuchszweck |
| badge_number | TEXT | Intern generierte Badge-Nummer (`B-XXXXX`) — wird **nicht mehr angezeigt** (kein Badge-PDF, keine E-Mail, kein Kiosk-Screen, keine Evakuierungsliste). Dient ausschließlich als zweiter Schlüssel für den QR-Checkout neben `qr_code` |
| qr_code | TEXT | QR-Code-Inhalt (bei Kiosk-Check-in via Vorregistrierung = Pre-Reg-QR-Code) |
| checked_in_at | DATETIME | Eincheck-Zeitstempel |
| checked_out_at | DATETIME | Auscheck-Zeitstempel (NULL = noch anwesend) |
| notes | TEXT | |
| status | TEXT | `active` / `completed` |
| privacy_policy_signed | INTEGER | 0 / 1 — Datenschutzerklärung unterzeichnet |
| privacy_policy_signature_path | TEXT | Dateiname der Unterschrift-PNG |

#### `preregistrations` — Vorregistrierungen
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_first_name | TEXT | |
| visitor_last_name | TEXT | |
| visitor_email | TEXT | QR-Code wird hierhin gesendet |
| visitor_company | TEXT | |
| host_id | INTEGER | FK → hosts |
| location_id | INTEGER | |
| expected_date | DATE | Erwartetes Anreisedatum |
| expected_time | TIME | Erwartete Anreisezeit |
| purpose | TEXT | |
| qr_code | TEXT UNIQUE | |
| status | TEXT | `pending` / `checked_in` / `expired` / `cancelled` |
| notes | TEXT | |
| group_id | TEXT | Gruppen-ID bei Sammelregistrierung (optional) |

#### `visit_purposes` — Besuchszwecke (konfigurierbar)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT UNIQUE | z.B. "Besprechung", "Lieferung" |
| sort_order | INTEGER | Reihenfolge |
| active | INTEGER | |

Standardwerte: Besprechung, Lieferung, Interview, Wartung, Sonstiges

#### `system_settings` — Systemkonfiguration (key/value)
| Key | Standardwert | Beschreibung |
|---|---|---|
| `gdpr_retention_days` | `365` | Tage bis zur Anonymisierung |
| `visitor_email_confirmation` | `true` | Check-in-Bestätigung an Besucher |
| `smtp_security` | `starttls` | SMTP-Verschlüsselung: `starttls` / `ssl` / `none` |
| `privacy_policy_text` | *(Platzhaltertext)* | Datenschutztext — im Kiosk angezeigt |
| `privacy_policy_enabled` | `true` | Datenschutz-Unterschrift im Kiosk aktivieren |
| `auto_checkout_enabled` | `true` | Auto-Checkout täglich aktivieren |
| `auto_checkout_time` | `19:00` | Uhrzeit des Auto-Checkouts (HH:MM) |
| `ad_ldap_url` | *(leer)* | LDAP-Server-URL für AD-Sync, z.B. `ldaps://ad.abat.de:636` |
| `ad_bind_dn` | *(leer)* | Bind-DN des Service-Accounts |
| `ad_bind_password` | *(leer)* | Bind-Passwort (Klartext in der DB — kein Secret-Store vorhanden) |
| `ad_base_dn` | *(leer)* | Such-Basis, z.B. `ou=abat AG,dc=abat,dc=de` |
| `ad_filter` | `(&(objectClass=user)(objectCategory=person))` | LDAP-Suchfilter |
| `ad_sync_enabled` | `false` | Täglichen automatischen Sync (03:00 Uhr) aktivieren |
| `ad_last_sync_at` | — | Zeitstempel des letzten Sync-Laufs (auch manuell ausgelöst) |
| `ad_last_sync_result` | — | JSON `{created, updated, deactivated, seen, errors}` des letzten Laufs |

> `printer_enabled` / `printer_ip` / `printer_port` existieren als Settings-Keys (Default `false` / leer / `9100`) und sind über `PUT /settings/system` weiterhin schreibbar, werden aber von keiner Route mehr gelesen — der Etikettendrucker-Service (`services/label-printer.js`) ist nicht mehr verdrahtet (siehe [1.](#1-projektübersicht)).

#### `visit_documents` — Hochgeladene Dokumente & Unterschriften
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visit_id | INTEGER | FK → visits |
| filename | TEXT | Gespeicherter Dateiname (zufällig generiert) |
| original_name | TEXT | Originaler Dateiname |
| document_type | TEXT | `nda` / `sonstiges` |
| signature_path | TEXT | PNG-Dateiname in `/uploads/signatures/` |
| signed_at | DATETIME | |

---

## 6. Backend API

**Base URL:** `https://visitor.luwilab.work/api`  
**Auth:** `Authorization: Bearer <JWT-Token>` (außer explizit als öffentlich markiert)  
**Admin-Token:** 8 Stunden Gültigkeit  
**Host-Token:** 12 Stunden Gültigkeit (`{ type: 'host', hostId }`)

### Authentifizierung (Admin)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/auth/login` | Nein | `{ email, password }` → bei aktivem 2FA `{ requires_2fa: true, pending_token }` (5 Min. gültig), sonst direkt `{ token, user, requires_2fa_setup }` |
| POST | `/auth/2fa/login-verify` | Nein (pending_token) | `{ pending_token, token }` ODER `{ pending_token, backup_code }` → `{ token, user }` |
| POST | `/auth/2fa/setup` | Ja | Erzeugt neues TOTP-Secret + QR-Code (`{ secret, otpauth_url, qr }`), noch nicht aktiv |
| POST | `/auth/2fa/verify-setup` | Ja | `{ token }` bestätigt Setup → aktiviert 2FA, gibt einmalig `backup_codes[]` zurück |
| POST | `/auth/2fa/disable` | Ja | `{ password }` erforderlich, deaktiviert 2FA für den eigenen Account |
| GET | `/auth/me` | Ja | Aktueller Benutzer |
| PUT | `/auth/change-password` | Ja | Passwort ändern |

> **2FA ist für alle `admin`-Konten verpflichtend.** Loggt sich ein Admin ohne aktives 2FA ein, leitet das Frontend (`ProtectedRoute` in `App.jsx`) automatisch und ohne Ausweichmöglichkeit auf `/2fa-setup` um — jede andere Seite bleibt bis zum Abschluss der Einrichtung gesperrt. `receptionist`- und Host-Konten haben kein 2FA.
>
> **Account-Lockout:** Nach 5 aufeinanderfolgenden Fehlversuchen (Passwort oder 2FA-Code) wird der Account für 15 Minuten gesperrt (`locked_until` in der DB). Ein Admin kann einen gesperrten Benutzer vorzeitig entsperren, siehe [Benutzer](#benutzer-nur-admin) unten.

### Dashboard

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/dashboard/stats` | Kennzahlen: heute, aktuell, Woche, Monat |
| GET | `/dashboard/recent` | Letzte 10 Besuche |
| GET | `/dashboard/chart` | Besuche pro Tag, letzte 14 Tage |

### Besucher

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/visitors` | Ja | Liste (?search=, ?status=) — standortgefiltert |
| POST | `/visitors` | **Nein** | Neu erstellen + einchecken (Kiosk-kompatibel) |
| GET | `/visitors/active` | Ja | Aktuell anwesend |
| GET | `/visitors/:id` | Ja | Details + Besuchshistorie |
| PUT | `/visitors/:id` | Ja | Stammdaten bearbeiten |
| DELETE | `/visitors/:id` | Ja (admin) | Dauerhaft löschen (inkl. Besuche + Dokumente) |
| POST | `/visitors/:id/checkin` | Ja | Erneut einchecken |
| GET | `/visitors/:id/badge/:visitId` | Ja | Badge als PDF |

### Besuche (Check-out)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/visits/:id/checkout` | Ja | Besucher auschecken |
| POST | `/visits/checkout-by-qr` | **Nein** | Kiosk: Auschecken per Badge-QR oder Vorregistrierungs-QR |
| POST | `/visits/checkout-by-abat-id` | **Nein** | Kiosk: Auschecken per abat-ID |
| GET | `/visits/search-active` | **Nein** | Kiosk: Aktive Besuche nach Name suchen |

### Vorregistrierungen

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/preregistrations` | Ja | Liste (?date_filter=, ?status=) |
| POST | `/preregistrations` | Ja | Einzelne Vorregistrierung + QR per E-Mail |
| POST | `/preregistrations/batch` | Ja | Gruppenregistrierung (mehrere Gäste) |
| PUT | `/preregistrations/:id` | Ja | Bearbeiten |
| DELETE | `/preregistrations/:id` | Ja | Admin: dauerhaft löschen; andere: stornieren |
| GET | `/preregistrations/qr-image/:qrcode` | **Nein** | QR-Code als PNG-Bild |
| GET | `/preregistrations/qr/:qrcode` | **Nein** | Kiosk: Infos via QR-Code |
| POST | `/preregistrations/qr/:qrcode/checkin` | **Nein** | Kiosk: Einchecken via QR |
| GET | `/preregistrations/by-abat-id/:abatId` | **Nein** | Kiosk: Vorregistrierung per abat-ID |

### Gastgeber

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/hosts` | **Nein** | Liste (öffentlich für Kiosk, ohne password_hash) |
| GET | `/hosts/:id` | Ja | Einzelner Gastgeber |
| POST | `/hosts` | Ja | Erstellen |
| PUT | `/hosts/:id` | Ja | Bearbeiten |
| PUT | `/hosts/:id/set-password` | Ja (admin) | Portal-Passwort setzen (min. 8 Zeichen) |
| DELETE | `/hosts/:id` | Ja | Soft-Delete |

### Host-Portal

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/host-portal/login` | Nein | `{ email, password }` → `{ token, host }` |
| GET | `/host-portal/me` | Host-Token | Eigene Host-Daten |
| GET | `/host-portal/visitors` | Host-Token | `{ upcoming, active, completed }` — alle Besuche des Hosts |
| POST | `/host-portal/preregistrations` | Host-Token | Vorregistrierung erstellen + QR per E-Mail (host_id automatisch gesetzt) |
| PUT | `/host-portal/change-password` | Host-Token | Eigenes Passwort ändern |

### Audit-Log (nur admin)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/audit-log/available-dates` | Liste aller Tage mit vorhandenen Log-Dateien |
| GET | `/audit-log/download?date=YYYY-MM-DD` | Tagesprotokoll als `.log`-Datei herunterladen |
| GET | `/audit-log/compliance-report?from=&to=` | Compliance-Bericht als CSV (Besuche + Ereignisse, ohne Badge-Nummer-Spalte) |

### Gastgeber-Synchronisierung (AD-Sync, nur admin)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/ad-sync/config` | Aktuelle LDAP-Konfiguration (Bind-Passwort maskiert als `••••••••`) |
| PUT | `/ad-sync/config` | `{ url, bindDn, bindPassword, baseDn, filter, enabled }` speichern — Passwort wird nur überschrieben, wenn ein neuer Wert ≠ `••••••••` gesendet wird |
| GET | `/ad-sync/status` | Letzter Sync-Zeitpunkt + Ergebnis (`{created, updated, deactivated, seen, errors}`) |
| POST | `/ad-sync/sync` | Manuellen Sync sofort auslösen (Fehler kommen als `400`, nicht `502`/`503`, damit Cloudflare den Body nicht durch eine generische Fehlerseite ersetzt) |

### Standorte

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/locations` | Alle aktiven Standorte |
| POST | `/locations` | Erstellen |
| PUT | `/locations/:id` | Bearbeiten |
| DELETE | `/locations/:id` | Deaktivieren |

### Besuchszwecke

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/visit-purposes` | **Nein** | Alle aktiven Zwecke, sortiert nach `sort_order` |
| POST | `/visit-purposes` | Ja | Erstellen |
| PUT | `/visit-purposes/reorder` | Ja | Reihenfolge aktualisieren `[{id, sort_order}]` |
| PUT | `/visit-purposes/:id` | Ja | Bearbeiten |
| DELETE | `/visit-purposes/:id` | Ja | Deaktivieren |

### Benutzer (nur admin)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/users` | Alle Benutzer inkl. `location_ids[]`, `failed_login_attempts`, `locked_until`, `totp_enabled` |
| POST | `/users` | Erstellen (mit `location_ids[]`); `role` muss `admin` oder `receptionist` sein |
| PUT | `/users/:id` | Bearbeiten (mit `location_ids[]`) |
| POST | `/users/:id/reset-password` | Passwort zurücksetzen |
| POST | `/users/:id/unlock` | Account-Lockout vorzeitig aufheben (`failed_login_attempts` = 0, `locked_until` = NULL) |
| POST | `/users/:id/2fa-reset` | 2FA eines anderen Benutzers zurücksetzen (Recovery, falls Authenticator-App verloren) — Benutzer muss es beim nächsten Login neu einrichten |
| DELETE | `/users/:id` | Deaktivieren (Soft-Delete); eigenes Konto kann nicht deaktiviert werden |
| DELETE | `/users/:id/permanent` | Endgültig aus der DB löschen — nur möglich, wenn der Benutzer bereits deaktiviert ist |

### Einstellungen (nur admin)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/settings/system` | Ja (admin) | Alle system_settings |
| PUT | `/settings/system` | Ja (admin) | Einstellungen speichern |
| GET | `/settings/smtp-config` | Ja (admin) | Aktuelle SMTP-Konfiguration (Passwort maskiert) |
| PUT | `/settings/smtp-config` | Ja (admin) | SMTP-Konfiguration in der DB speichern |
| GET | `/settings/privacy-policy` | **Nein** | Datenschutztext + enabled-Flag (für Kiosk) |
| GET | `/settings/ms-sso/status` | **Nein** | `{ available }` — liest **aus `.env`** (`MS_SSO_ENABLED`/`MS_CLIENT_ID`/`MS_CLIENT_SECRET`/`MS_TENANT_ID`), unabhängig von der tatsächlichen SSO-Konfiguration in `system_settings` (siehe Hinweis in [16.](#16-host-portal)) |
| POST | `/settings/email-test` | Ja (admin) | Test-E-Mail senden |
| POST | `/settings/gdpr/cleanup` | Ja (admin) | GDPR-Bereinigung ausführen |

### Berichte

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/reports/daily?date=YYYY-MM-DD` | Ja | Tagesbericht — standortgefiltert für Receptionist |
| GET | `/reports/monthly?year=YYYY&month=MM` | Ja | Monatsbericht — standortgefiltert für Receptionist |
| GET | `/reports/evacuation` | Ja | Evakuierungsliste — nach Standort gruppiert, ohne Badge-Nummer |
| GET | `/reports/export?from=&to=&format=json` | Ja | JSON-Vorschau, für alle Rollen (Receptionist nur eigene Standorte) — Admin kann zusätzlich per `?location_id=` filtern |
| GET | `/reports/export?from=&to=&format=csv` | Ja (**admin**) | CSV-Download — für `receptionist` `403`, seit CSV-Export im Frontend admin-only ist |

> Alle Berichts-Endpunkte akzeptieren bei Admin optional `?location_id=` zur gezielten Filterung; ohne diesen Parameter sieht der Admin alle Standorte. Die CSV-Spalte "Badge-Nr." wurde entfernt.

### Dokumenten-Upload & Unterschrift

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/visits/:visitId/documents` | Nein* | Dokument hochladen (für Kiosk) |
| POST | `/documents/:docId/signature-base64` | Nein* | Unterschrift speichern (für Kiosk) |
| GET | `/visits/:visitId/documents` | Ja | Dokumente abrufen |
| GET | `/documents/:docId/download` | Ja | Dokument herunterladen |

---

## 7. Frontend & Seiten

| Route | Seite | Auth | Beschreibung |
|---|---|---|---|
| `/login` | Login | Nein | Admin-Login |
| `/host/login` | HostLogin | Nein | Gastgeber-Portal Login |
| `/host` | HostPortal | Host-Token | Gastgeber-Portal |
| `/kiosk` | KioskStart | **Nein** | Sprachschalter DE/EN, 2 Optionen |
| `/kiosk/checkin` | KioskCheckin | **Nein** | QR-Scan oder abat-ID |
| `/kiosk/checkout` | KioskCheckout | **Nein** | QR, abat-ID oder Namenssuche |
| `/kiosk/manual` | KioskManual | **Nein** | Walk-in Formular |
| `/dashboard` | Dashboard | Ja | Kennzahlen, Diagramm, Quick-Check-in |
| `/visitors` | Besucher | Ja | Tabs: Alle / Angekündigt / Aktiv / Verlassen |
| `/hosts` | Gastgeber | Ja | inkl. Portal-Passwort setzen (admin) |
| `/preregistrations` | Vorregistrierung | Ja | Einzel- und Gruppenregistrierung |
| `/evacuation` | Evakuierung | Ja | Nach Standort gruppiert, Drucklayout |
| `/reports` | Berichte | Ja | Tages-/Monatsberichte; Standortfilter + CSV-Export nur admin, receptionist sieht nur eigene Standorte |
| `/settings` | Einstellungen | Ja (admin) | Alle Konfigurations-Tabs |
| `/audit-log` | Audit-Log & Compliance | Ja (admin) | Protokoll-Download, Compliance-Bericht |
| `/2fa-setup` | 2FA-Einrichtung | Ja | Erzwungen für `admin`-Konten ohne aktives 2FA — keine andere Seite erreichbar bis abgeschlossen |
| `*` | NotFound | — | 404-Fehlerseite |

### Einstellungs-Tabs (Settings.jsx)

| Tab | Inhalt | Rolle |
|---|---|---|
| Standorte | CRUD Standorte (inkl. Land, Zeitzone, Vor-Ort-Kontakt), Suchfilter ab 5 Einträgen | alle mit Zugriff auf Einstellungen |
| Besuchszwecke | CRUD Besuchszwecke | alle mit Zugriff auf Einstellungen |
| Benutzer | CRUD Benutzer + Standortzuweisung, Account-Entsperrung, 2FA-Reset, endgültiges Löschen | admin |
| Auto-Checkout | Aktivieren/Deaktivieren + Uhrzeit einstellen | admin |
| Gastgeber-Sync | AD-Sync-Konfiguration (LDAP-URL, Bind-DN/-Passwort, Base-DN, Filter), manueller Sync-Trigger | admin |
| Datenschutz | GDPR Aufbewahrungsdauer, Bereinigung, E-Mail-Bestätigung | alle mit Zugriff auf Einstellungen |
| E-Mail | SMTP-Konfiguration, Verschlüsselung, Test-E-Mail — nur `admin` kann bearbeiten, andere sehen read-only | alle mit Zugriff auf Einstellungen |
| Passwort ändern | Eigenes Passwort ändern + 2FA einrichten/deaktivieren | alle |

> `/settings` und `/audit-log` sind in der Sidebar nur für `admin` sichtbar — `receptionist` hat keinen Zugriff auf Einstellungen.

### Aktionsrechte nach Rolle

| Aktion | admin | receptionist |
|---|---|---|
| Besucher dauerhaft löschen | ✓ | ✗ |
| Vorregistrierung dauerhaft löschen | ✓ | ✗ |
| Vorregistrierung stornieren | ✓ | ✓ |
| Gastgeber-Portal-Passwort setzen | ✓ | ✗ |
| Audit-Log & Compliance-Bericht | ✓ | ✗ |
| Auto-Checkout konfigurieren | ✓ | ✗ |
| Gastgeber-Sync (AD) konfigurieren | ✓ | ✗ |
| Benutzer verwalten, entsperren, 2FA zurücksetzen | ✓ | ✗ |
| Berichte als CSV exportieren | ✓ | ✗ (nur JSON-Vorschau, eigene Standorte) |
| 2FA-Pflicht beim Login | ✓ (verpflichtend) | — (kein 2FA) |

---

## 8. Kiosk-System

Läuft ohne Login, ausgelegt für Tablets am Empfang. Alle Kiosk-Routen sind öffentlich.

### Startseite (`/kiosk`)

Zwei Optionen:
- **Einchecken** → `/kiosk/checkin`
- **Auschecken** → `/kiosk/checkout`

### Mehrsprachigkeit

Der Kiosk unterstützt Deutsch und Englisch. Die Sprache wird per `localStorage` (Key: `kiosk_lang`) gespeichert. Der Sprachumschalter erscheint auf **allen** Kiosk-Seiten rechts oben im Header (via `KioskHeader`-Komponente).

### Check-in Flow (`/kiosk/checkin`) — Mehrstufig

```
scan → confirm → privacy → success
               ↘ (wenn Datenschutz deaktiviert) → success
```

| Stufe | Inhalt |
|---|---|
| **scan** | QR-Code per Kamera scannen **oder** abat-ID eingeben (`ABAT-` vorausgefüllt, 8 Ziffern) |
| **confirm** | Vorregistrierungsdaten anzeigen und ggf. korrigieren (Vorname, Nachname, Unternehmen) |
| **privacy** | Scrollbarer Datenschutztext + Unterschriftsfeld; Button erst nach Unterschrift aktiv |
| **success** | abat-ID groß angezeigt, Gastgeber; automatischer Rücksprung nach 6 Sekunden (Badge-Nr. wird nicht mehr angezeigt) |

### Check-out (`/kiosk/checkout`) — 3 Tabs

| Tab | Methode |
|---|---|
| QR-Code scannen | Kamera scannt Badge-QR → `POST /visits/checkout-by-qr` |
| abat-ID | `ABAT-` Präfix vorausgefüllt, 8 Ziffern → `POST /visits/checkout-by-abat-id` |
| Name suchen | Freitext-Suche → `GET /visits/search-active` → Auswahl → Check-out |

### Walk-in (`/kiosk/manual`)

Formularfelder: Vorname *, Nachname *, Gastgeber *, Unternehmen, Besuchszweck, Notizen.

### QR-Checkout — Unterstützte Codes

`POST /visits/checkout-by-qr` akzeptiert zwei QR-Code-Typen:
- **Badge-QR:** enthält `badge_number` (z.B. `B-12345`) → Suche via `visits.badge_number`. Der Code wird intern weiterhin bei jedem Check-in erzeugt, aber seit der Entfernung der Badge-Nummer aus PDF/Etikett/Kiosk-Anzeige gibt es aktuell keine UI mehr, die diesen Code für Besucher sichtbar macht — der Pfad bleibt aus Kompatibilitätsgründen im Backend erhalten.
- **Vorregistrierungs-QR** (aus der Einladungs-E-Mail): enthält `PRE-xxx-yyy` → Suche via `visits.qr_code` (wird beim Check-in gespeichert). Dies ist der einzige QR-Code, der Besuchern aktuell tatsächlich angezeigt/zugestellt wird.

### QR-Scanner — Technische Besonderheit

`QRScanner.jsx` verwendet `html5-qrcode`. Ein `stoppedRef`-Flag (`useRef(false)`) verhindert Doppel-`stop()`-Aufrufe, die sonst zu einem weißen Bildschirm führen können.

---

## 9. Mehrsprachigkeit (i18n)

Das Admin-, Empfangs- und Gastgeber-Panel unterstützt Deutsch und Englisch. Der Kiosk hat ein separates, unabhängiges i18n-System (DE/EN via `KioskLangContext`).

### Unterstützte Sprachen

| Code | Sprache | Flag |
|---|---|---|
| `de` | Deutsch | 🇩🇪 (Standard) |
| `en` | English | 🇬🇧 |

### Technische Umsetzung

- **Bibliothek:** `react-i18next` + `i18next`
- **Initialisierung:** `frontend/src/i18n/index.js` (wird in `main.jsx` importiert)
- **Sprachdateien:** `frontend/src/i18n/de.js`, `en.js`
- **Namespace:** Einzelner Namespace `translation` — ein Objekt pro Sprache, strukturiert nach Sektionen
- **Persistenz:** Gewählte Sprache wird in `localStorage` unter dem Key `admin_lang` gespeichert; gespeicherte Werte außer `de`/`en` fallen auf `de` zurück
- **Hook:** `const { t } = useTranslation()` in jedem übersetzten Komponent
- **Sprachumschalter:** `LangSwitcher`-Komponente in der Sidebar (Globe-Icon + Dropdown mit Flaggen)

### Übersetzungsstruktur

```
translation
├── nav.*           Seitennavigation
├── common.*        Allgemeine Begriffe (Speichern, Abbrechen, Laden …)
├── status.*        Status-Labels (Anwesend, Ausgecheckt …)
├── roles.*         Rollenbezeichnungen
├── login.*         Login-Seite (Admin + Gastgeber)
├── layout.*        Header-Elemente
├── dashboard.*     Dashboard (Kennzahlen, Diagramm, letzte Besuche)
├── visitors.*      Besucherverwaltung (Tabs, Formular, Tabelle)
├── hosts.*         Gastgeberverwaltung
├── preregistrations.* Vorregistrierungen
├── evacuation.*    Evakuierungsliste
├── reports.*       Berichte & Export
├── settings.*      Einstellungen (alle Tabs)
├── auditLog.*      Audit-Log & Compliance
└── hostPortal.*    Gastgeber-Portal
```

### Kiosk-Sprache (separat)

Der Kiosk (`KioskLangContext.jsx`) hat ein eigenes, unabhängiges Übersetzungssystem (DE/EN), das **nicht** mit `react-i18next` arbeitet und vollständig von der Admin-i18n getrennt ist. Die Kiosk-Sprache wird separat in `localStorage` unter `kiosk_lang` gespeichert und beeinflusst das Admin-Panel nicht.

### Sprachdateien hinzufügen / erweitern

```
frontend/src/i18n/
├── index.js   ← i18next-Konfiguration (Sprachen registrieren, localStorage-Fallback)
├── de.js      ← Deutsch (Referenz-Datei)
└── en.js      ← Englisch
```

Um eine neue Sprache hinzuzufügen:
1. Neue Datei `xy.js` anlegen (Kopie von `de.js`, Inhalte übersetzen)
2. In `index.js` importieren und als `xy: { translation: xy }` registrieren; erlaubte Codes im Fallback-Array ergänzen
3. In `Sidebar.jsx` das `LANGUAGES`-Array um `{ code: 'xy', label: '...', flag: '🏳️' }` erweitern

---

## 10. abat-ID

Jeder Besucher erhält eine permanente, einzigartige Kennung im Format `ABAT-########` (8 zufällige Ziffern).

| Eigenschaft | Wert |
|---|---|
| Format | `ABAT-00000000` bis `ABAT-99999999` |
| Speicherort | `visitors.abat_id` (UNIQUE INDEX) |
| Vergabe | Bei Vorregistrierung (wenn E-Mail angegeben) oder beim ersten Check-in |
| Beständigkeit | Permanent — bleibt bei allen späteren Besuchen gleich |

**Einsatz:**
- In der Vorregistrierungs-E-Mail als Fallback zum QR-Code
- Am Kiosk-Check-in und Check-out (Tab "abat-ID")
- Im Admin-Dashboard und Besucherliste als eigene Spalte

---

## 11. Dokumenten-Upload & Unterschrift

Ablauf: Besucher einchecken → Dokument hochladen (optional) → Unterschrift leisten (optional).

- Formate: PDF/DOC/DOCX, max. 20 MB
- Unterschrift als PNG (Canvas, Touch/Maus)
- Speicherorte: `/backend/uploads/documents/` und `/backend/uploads/signatures/`
- Beide Verzeichnisse sind **nur mit Admin-Token** über die API abrufbar

---

## 12. Zugangsdaten & Benutzerrollen

> Zugangsdaten werden separat verwaltet und nicht in der Dokumentation hinterlegt.

### Rollen & Berechtigungen

Die Rolle `superadmin` wurde entfernt und beim Upgrade automatisch zu `admin` migriert (`UPDATE users SET role = 'admin' WHERE role = 'superadmin'` läuft bei jedem Serverstart in `database.js`, ist danach ein No-Op). Es gibt jetzt nur noch zwei Admin-Panel-Rollen plus die separate Host-Rolle:

| Berechtigung | admin | receptionist | host |
|---|---|---|---|
| Dashboard | ✓ | ✓ | ✗ |
| Besucher verwalten | ✓ | ✓ (standortgef.) | ✗ |
| Besucher löschen | ✓ | ✗ | ✗ |
| Gastgeber verwalten | ✓ | ✓ | ✗ |
| Vorregistrierungen | ✓ | ✓ | ✓ (nur eigene) |
| Evakuierungsliste | ✓ | ✓ (standortgef.) | ✗ |
| Berichte (JSON-Vorschau) | ✓ | ✓ (nur eigene Standorte) | ✗ |
| Berichte als CSV exportieren | ✓ | ✗ | ✗ |
| Einstellungen | ✓ | ✗ | ✗ |
| Benutzer verwalten / entsperren / 2FA-Reset | ✓ | ✗ | ✗ |
| Auto-Checkout konfigurieren | ✓ | ✗ | ✗ |
| Gastgeber-Sync (AD) konfigurieren | ✓ | ✗ | ✗ |
| Audit-Log & Compliance | ✓ | ✗ | ✗ |
| 2FA beim Login | ✓ (verpflichtend) | ✗ (kein 2FA) | ✗ (kein 2FA) |
| Host-Portal | ✗ | ✗ | ✓ |

### Host-Accounts

Gastgeber-Accounts werden in der `hosts`-Tabelle verwaltet — entweder manuell oder automatisch per [AD-Sync](#15b-gastgeber-synchronisierung-ad-sync). Ein Portal-Passwort wird von einem Admin unter **Gastgeber → Schlüssel-Icon** gesetzt (min. 8 Zeichen). Das Login erfolgt unter `/host/login` mit der E-Mail-Adresse des Gastgebers, optional per Microsoft-SSO-Button (siehe Hinweis in [16.](#16-host-portal)).

---

## 12a. Standortbasierte Zugriffskontrolle

Benutzer können auf bestimmte Standorte beschränkt werden.

1. In **Einstellungen → Benutzer** werden Standorte zugewiesen
2. Zuordnung wird in `user_locations` gespeichert
3. Auth-Middleware lädt `location_ids[]` bei jedem Request
4. Gefilterte Endpunkte: `GET /visitors`, `GET /visitors/active`, `GET /reports/evacuation`, `GET /reports/daily`, `GET /reports/monthly`, `GET /reports/export`

| Situation | Verhalten |
|---|---|
| admin | Immer alle Standorte, kann zusätzlich per `?location_id=` gezielt filtern |
| Receptionist mit 0 Standorten | Alle Standorte sichtbar |
| Receptionist mit 1+ Standorten | Nur zugewiesene Standorte |

---

## 13. Check-in am Empfang (Dashboard/Visitors)

> **Hinweis:** Das frühere Schnell-Check-in-Modal im Dashboard (automatische Vorschläge aus heutigen Vorregistrierungen, 1–2-Klick-Check-in) wurde entfernt. Das Dashboard zeigt seit diesem Umbau nur noch Kennzahlen, Diagramm und die Liste der letzten Besuche (mit Check-out-Aktion) — kein Check-in-Formular mehr.

Das manuelle Einchecken neuer Besucher erfolgt jetzt ausschließlich über **Besucher → Neuer Besucher** (`Visitors.jsx`, Formular-Komponente `VisitorCheckinForm`):

| Feld | Pflicht | Hinweis |
|---|---|---|
| Vorname / Nachname | ✅ | |
| E-Mail | — | Kein Telefonfeld mehr (Spalte `visitors.phone` wurde entfernt) |
| Unternehmen | — | |
| Gastgeber | ✅ | Aus Liste oder manuell (Freitext) |
| Besuchszweck | — | Aus konfigurierten Besuchszwecken |
| Notizen | — | |
| Datenschutzerklärung unterschrieben | — | Checkbox (Feldname in der DB weiterhin `nda_signed`) |

**Backend:** `POST /visitors` (öffentlich, Kiosk-kompatibel) legt bei Bedarf einen neuen `visitors`-Datensatz an (Dedupe per E-Mail, dann Name) und erstellt den `visits`-Eintrag. Bereits bekannte Besucher, die erneut einchecken, nutzen `POST /visitors/:id/checkin`.

Vorregistrierte Besucher werden weiterhin regulär über den Kiosk (QR-Code oder abat-ID) oder über **Vorregistrierungen** eingecheckt — nur der separate Schnell-Check-in-Shortcut im Dashboard existiert nicht mehr.

---

## 14. E-Mail-System

### Ausgehende E-Mails

| Auslöser | Empfänger | Beschreibung |
|---|---|---|
| Vorregistrierung erstellt | Besucher | QR-Code (CID-Anhang), abat-ID, Besuchsdetails |
| Check-in | Gastgeber | Benachrichtigung: Besucher eingetroffen |
| Check-in (`visitor_email_confirmation = true`) | Besucher | Bestätigung mit Datum, Zeit, Gastgeber (ohne Badge-Nr.) |

### SMTP-Konfiguration

In `.env` gespeichert (Neustart bei Änderung nötig). Verschlüsselung (`smtp_security`) in `system_settings` ohne Neustart änderbar.

| Option | Port | Verwendung |
|---|---|---|
| **STARTTLS** | 587 | Standard — Gmail, Office 365 |
| **SSL / TLS** | 465 | Ältere Server / manche Hoster |
| **Keine** | 25 | Interne Mailserver ohne Zertifikat |

**Fallback:** Ohne SMTP-Konfiguration werden E-Mails nur in der Konsole geloggt — kein Absturz.

---

## 15. Auto-Checkout

Alle Besucher, die sich bis zur konfigurierten Uhrzeit nicht ausgecheckt haben, werden automatisch ausgecheckt.

### Funktionsweise

- Implementiert via nativem `setTimeout` in `backend/src/services/auto-checkout.js`
- Kein externer Cron-Job oder externes Paket erforderlich
- Plant sich nach jedem Lauf automatisch für den nächsten Tag neu
- Beim Serverstart wird der nächste Lauf berechnet und geplant

### Konfiguration

**Einstellungen → Auto-Checkout (admin):**

| Einstellung | Key in `system_settings` | Beschreibung |
|---|---|---|
| Aktiviert | `auto_checkout_enabled` | Ein/Aus |
| Uhrzeit | `auto_checkout_time` | Format `HH:MM`, Standard `19:00` |

### Audit-Log-Eintrag

Bei jedem Auto-Checkout wird ein `AUTO_CHECKOUT`-Eintrag im Audit-Log geschrieben mit Anzahl der ausgecheckten Besucher.

---

## 15a. Vorregistrierungs-Ablauf (Expiry-Job)

Alle `pending`-Vorregistrierungen, deren `expected_date` in der Vergangenheit liegt, werden automatisch auf `expired` gesetzt.

### Funktionsweise

- Implementiert in `backend/src/services/prereg-expiry.js`
- Läuft beim **Serverstart** (bereinigt sofort ggf. vorhandene Rückstände)
- Plant sich danach täglich um **00:05 Uhr** neu (via `setTimeout`)
- Schreibt Änderungsanzahl in die Konsole

### Verhalten im Frontend

- Vorregistrierungsansicht zeigt standardmäßig nur `pending`-Einträge
- Abgelaufene Einträge erscheinen nicht mehr in der Übersicht

---

## 15b. Gastgeber-Synchronisierung (AD-Sync)

Gastgeber können automatisch aus dem Active Directory / LDAP-Verzeichnis der Firma übernommen werden, statt jeden Gastgeber manuell im Admin-Panel anzulegen.

### Konfiguration (Einstellungen → Gastgeber-Sync, nur admin)

| Feld | Beschreibung |
|---|---|
| LDAP-Server-URL | z.B. `ldaps://ad.abat.de:636` |
| Bind-DN | Service-Account für den LDAP-Bind, z.B. `cn=svc-visitormgmt,ou=Service Accounts,dc=abat,dc=de` |
| Bind-Passwort | Wird beim Speichern nur überschrieben, wenn ein neuer Wert eingegeben wird (Anzeige sonst als `••••••••`) |
| Base-DN | Such-Basis, z.B. `ou=abat AG,dc=abat,dc=de` |
| LDAP-Filter | Standard `(&(objectClass=user)(objectCategory=person))` — über Base-DN/Filter auf die gewünschte OU einschränken |
| Automatischer täglicher Sync | Ein/Aus — bei Aktivierung läuft der Sync jeden Tag um **03:00 Uhr** |

Die gesamte Konfiguration liegt in `system_settings` (Keys `ad_*`, siehe [Abschnitt 5](#5-datenbank)) — es sind **keine** `.env`-Variablen nötig.

### Ablauf eines Sync-Laufs (`backend/src/services/ad-sync.js`)

1. LDAP-Bind mit Bind-DN/-Passwort (`ldapts`)
2. Suche unter Base-DN mit dem konfigurierten Filter, Attribute `cn`, `displayName`, `mail`, `telephoneNumber`, `department`
3. Für jeden Treffer mit Name **und** E-Mail: bestehenden Host anhand `hosts.ldap_dn` (= LDAP-DN) suchen
   - Gefunden → `name`, `email`, `phone`, `department` aktualisieren, `active = 1`
   - Nicht gefunden → neuer Host mit `ldap_dn` gesetzt
   - Treffer ohne Name/E-Mail werden übersprungen und im Ergebnis als Fehler aufgelistet
4. Hosts, die früher per AD-Sync angelegt wurden (`ldap_dn IS NOT NULL`), aber im aktuellen Suchergebnis fehlen, werden **soft-deaktiviert** (`active = 0`) — z.B. wenn ein Mitarbeiter das Unternehmen verlässt
5. Ergebnis (`created`, `updated`, `deactivated`, `seen`, `errors`) wird zusammen mit dem Zeitstempel in `system_settings` (`ad_last_sync_at`, `ad_last_sync_result`) gespeichert

### Manueller Sync

**Einstellungen → Gastgeber-Sync → "Jetzt synchronisieren"** löst `POST /ad-sync/sync` sofort aus, unabhängig vom täglichen Zeitplan. Ergebnis und eventuelle Fehler (z.B. Bind-Fehler, falscher Filter) werden direkt im UI angezeigt.

### Manuell angelegte Hosts bleiben unberührt

Hosts ohne `ldap_dn` (manuell im Admin-Panel angelegt) werden vom Sync weder verändert noch deaktiviert — der Abgleich betrifft ausschließlich Hosts, die selbst aus dem AD stammen.

---

## 16. Host-Portal

Gastgeber erhalten Zugang zu einem separaten Portal unter `/host/login`, ohne dass sie Admin-Zugang benötigen.

### Funktionen

| Funktion | Beschreibung |
|---|---|
| Angekündigt | Ausstehende Vorregistrierungen des Gastgebers |
| Aktuell anwesend | Eingecheckte Besucher in Echtzeit (30 s Auto-Refresh) |
| Vergangene Besucher | Alle abgeschlossenen Besuche (bis 100), aufklappbar |
| Vorregistrierung erstellen | Einzelregistrierung; host_id wird automatisch auf den eingeloggten Gastgeber gesetzt |
| Passwort ändern | Gastgeber kann sein Portal-Passwort selbst ändern (aktuelles Passwort erforderlich) |

**Mobile Optimierung:** Das Portal ist vollständig responsiv. Auf Smartphones erscheinen Besucherlisten als Karten statt Tabellen und die Navigation läuft über eine fixe Bottom-Navigation. Formulare sind einspalt auf Mobile, zweispaltig auf Desktop.

### Technische Umsetzung

- **Separates JWT:** `{ type: 'host', hostId }` — verhindert Privilege-Escalation zwischen Admin- und Host-Token
- **Token-Gültigkeit:** 12 Stunden
- **Gespeichert:** `host_token` in `localStorage`
- **Middleware:** `authenticateHost()` in `routes/host-portal.js` prüft `type === 'host'`
- **Link im Admin-Header:** Neben "Kiosk öffnen" — öffnet `/host` in neuem Tab
- **Responsive:** Cards (`sm:hidden`) + Tabellen (`hidden sm:block`) + Bottom-Nav (`sm:hidden fixed bottom-0`)
- **Account-Lockout:** Wie beim Admin-Login sperrt das Host-Portal einen Account nach 5 Fehlversuchen für 15 Minuten (`hosts.failed_login_attempts` / `locked_until`)

### ⚠️ Microsoft SSO — aktuell nicht funktionsfähig ohne Zusatzarbeit

Der "Mit Microsoft anmelden"-Button auf `/host/login` und der komplette OAuth-Redirect-Flow (`GET /host-portal/auth/microsoft`) sind implementiert, aber **zwei unterschiedliche Konfigurationsquellen sind nicht miteinander verbunden**:

- Der Button wird nur eingeblendet, wenn `GET /settings/ms-sso/status` `available: true` liefert — dieser Endpunkt liest die Variablen `MS_SSO_ENABLED` / `MS_CLIENT_ID` / `MS_CLIENT_SECRET` / `MS_TENANT_ID` **aus der `.env`**.
- Der eigentliche Login-Flow in `routes/host-portal.js` (`getMsSsoConfig()`) liest seine Konfiguration jedoch **aus `system_settings`** (Keys `ms_sso_enabled`, `ms_client_id`, `ms_client_secret`, `ms_tenant_id`) — und es gibt **keine** Admin-UI oder Route, die diese Keys beschreibt.

Ergebnis: Werden die `.env`-Variablen gesetzt, erscheint der Button — ein Klick landet aber immer bei `sso_not_configured`, weil die DB-Werte leer bleiben. Vor einem produktiven Einsatz von Microsoft-SSO muss entweder (a) ein Settings-Endpunkt ergänzt werden, der `ms_*` in `system_settings` schreibt, oder (b) `getMsSsoConfig()` in `host-portal.js` so geändert werden, dass er wie der Status-Endpunkt aus `process.env` liest.

### Portal-Passwort einrichten

1. Admin öffnet **Gastgeber** im Admin-Panel
2. Klick auf das Schlüssel-Icon in der Zeile des Gastgebers
3. Passwort eingeben (min. 8 Zeichen) und bestätigen
4. Gastgeber kann sich nun unter `/host/login` mit E-Mail + Passwort anmelden

---

## 17. Audit-Log & Compliance

### Protokollierung

Alle sicherheitsrelevanten Ereignisse werden automatisch protokolliert:

| Ereignis | Wann |
|---|---|
| `LOGIN` | Erfolgreicher Admin-Login (ohne 2FA bzw. nach bestandener 2FA) |
| `LOGIN_FAILED` | Fehlgeschlagener Login-Versuch (Passwort) |
| `LOGIN_BLOCKED` | Login-Versuch auf gesperrten Account |
| `LOGIN_2FA_PENDING` | Passwort korrekt, wartet auf 2FA-Code |
| `LOGIN_2FA` | 2FA-Code erfolgreich bestätigt |
| `LOGIN_2FA_FAILED` | Falscher 2FA-Code oder Backup-Code |
| `LOGIN_2FA_BACKUP` | Login per Backup-Code (statt Authenticator-App) |
| `2FA_AKTIVIERT` | Benutzer hat 2FA erfolgreich eingerichtet |
| `2FA_DEAKTIVIERT` | Benutzer hat 2FA deaktiviert |
| `CHECKIN` | Besucher eingecheckt |
| `CHECKOUT` | Besucher ausgecheckt |
| `AUTO_CHECKOUT` | Automatischer Checkout um konfigurierte Uhrzeit |
| `VORREGISTRIERUNG` | Vorregistrierung erstellt |
| `VORREGISTRIERUNG_GELÖSCHT` | Vorregistrierung dauerhaft gelöscht |
| `VISITOR_GELÖSCHT` | Besucher-Datensatz dauerhaft gelöscht |
| `AD_SYNC` | AD-Sync (geplant oder manuell) erfolgreich abgeschlossen |
| `AD_SYNC_FEHLER` | AD-Sync fehlgeschlagen (z.B. Bind-Fehler) |

> `LOGIN_2FA_*`- und `2FA_*`-Ereignisse betreffen ausschließlich Admin-Logins (`users`-Tabelle) — das Host-Portal hat kein 2FA.

### Dateiformat

- **Speicherort:** `/opt/visitor-mgmt/logs/audit-YYYY-MM-DD.log`
- **Format:** JSON-Lines (eine JSON-Zeile pro Ereignis)
- **Beispiel:** `{"ts":"2026-06-16T10:23:45.123Z","action":"LOGIN","actor":"admin@abat.de","detail":"Admin-Login erfolgreich"}`
- **Aufbewahrung:** 90 Tage — ältere Dateien werden automatisch beim Serverstart gelöscht

### Zugang im Admin-Panel

Nur für admin unter `/audit-log`:

- **Tagesprotokoll herunterladen:** Liste aller verfügbaren Tage, Download als `.log`-Rohdatei
- **Compliance-Bericht:** CSV-Download für einen Zeitraum mit:
  - Abschnitt 1: Alle Besuche (abat-ID, Name, Firma, Gastgeber, Zeiten, Status)
  - Abschnitt 2: Alle Audit-Log-Ereignisse
  - Format: UTF-8 CSV mit BOM (direkt in Excel öffenbar)

---

## 18. Sicherheit

### HTTP-Sicherheitsheader (helmet)

| Header | Wert |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` — verhindert Clickjacking |
| `X-Content-Type-Options` | `nosniff` — verhindert MIME-Sniffing |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

### Brute-Force-Schutz

Zwei unabhängige Schichten:

1. **IP-basiertes Rate-Limiting** (`express-rate-limit`): max. **20 Versuche pro 15 Minuten** pro IP-Adresse auf `POST /auth/login` und `POST /host-portal/login`.
2. **Account-basierter Lockout** (DB-gestützt, unabhängig von der IP): Nach **5 fehlgeschlagenen Versuchen** (falsches Passwort oder falscher 2FA-/Backup-Code) wird der jeweilige Account für **15 Minuten** gesperrt (`failed_login_attempts` / `locked_until` in `users` bzw. `hosts`). Der Zähler wird bei jedem erfolgreichen Login zurückgesetzt. Ein Admin kann eine Sperre vorzeitig über `POST /users/:id/unlock` aufheben.

### Zwei-Faktor-Authentifizierung (2FA / TOTP)

- **Verpflichtend für die Rolle `admin`** — beim ersten Login ohne aktives 2FA leitet das Frontend zwingend auf `/2fa-setup` um, jede andere Seite bleibt gesperrt (`ProtectedRoute` in `App.jsx`, serverseitig zusätzlich über `requires_2fa_setup` im Login-Response signalisiert).
- **Implementierung:** `otplib` (`backend/src/services/totp.js`), Zeitfenster `window: 2` (±2 Schritte = ±60s Toleranz für Uhrenabweichung/Tippzeit)
- **Secret & QR-Code:** `POST /auth/2fa/setup` erzeugt ein neues Base32-Secret und einen `otpauth://`-QR-Code (per `qrcode`-Service) zum Scannen mit einer Authenticator-App
- **Backup-Codes:** 10 Einmal-Codes (je 10 Hex-Zeichen) werden bei `POST /auth/2fa/verify-setup` erzeugt, als bcrypt-Hashes gespeichert und **nur einmal im Klartext** an den Client zurückgegeben — der Benutzer muss sie sofort sichern
- **Login-Flow:** `POST /auth/login` gibt bei aktivem 2FA statt eines Tokens `{ requires_2fa: true, pending_token }` zurück (`pending_token` 5 Min. gültig); `POST /auth/2fa/login-verify` tauscht Code oder Backup-Code gegen das finale Session-JWT
- **Deaktivieren:** `POST /auth/2fa/disable` erfordert das aktuelle Passwort
- **Recovery:** Verliert ein Admin den Zugriff auf Authenticator-App **und** Backup-Codes, kann ein anderer Admin über **Einstellungen → Benutzer** (`POST /users/:id/2fa-reset`) das 2FA des betroffenen Kontos zurücksetzen — beim nächsten Login muss es neu eingerichtet werden
- `receptionist`- und Host-Konten haben kein 2FA

### Dateigeschützte Uploads

| Pfad | Zugriffsschutz |
|---|---|
| `/uploads/photos/` | Erfordert Admin-JWT |
| `/uploads/documents/` | Erfordert Admin-JWT |
| `/uploads/signatures/` | Erfordert Admin-JWT |

> Vormals war `/uploads/photos/` ohne Auth-Middleware über `express.static` erreichbar (Kommentar im Code: „photos public, used in admin UI"). Das Feature war jedoch nie tatsächlich angebunden (Verzeichnis leer, keine Frontend-Referenzen) — trotzdem wurde die Lücke im Rahmen der Sicherheits-Härtung geschlossen. Alle drei Upload-Pfade verlangen nun einheitlich Authentifizierung.

### Validierung von Dokumenten-Uploads

Beim Hochladen von Dokumenten (z.B. NDA) in `backend/src/routes/documents.js` reicht eine passende Dateiendung (`.pdf`, `.doc`, `.docx`) allein nicht mehr aus:

- Nach dem Upload wird zusätzlich die **Datei-Signatur (Magic Bytes)** geprüft (z.B. muss eine echte PDF-Datei mit `%PDF-` beginnen).
- Stimmt der tatsächliche Dateiinhalt nicht mit der behaupteten Endung überein, wird die Datei gelöscht und die Anfrage mit `400` abgelehnt.

Damit lässt sich beliebiger Dateiinhalt nicht mehr als vermeintliches Dokument einschleusen.

### Passwörter

- bcrypt mit **Kostenfaktor 12** (alle neuen Hashes)
- Mindestlänge: **8 Zeichen** für alle Konten
- `password_hash` wird **nie** über die API zurückgegeben

### JWT-Secret

- 128-Byte kryptografisch zufälliger Secret (generiert mit `crypto.randomBytes(64).toString('hex')`)
- Gespeichert in `/opt/visitor-mgmt/backend/.env`
- Bei Änderung des Secrets werden alle aktiven Sessions invalidiert
- Kein unsicherer Fallback: `backend/src/routes/auth.js` und `backend/src/routes/host-portal.js` enthielten früher `process.env.JWT_SECRET || 'secret'` — einen fest codierten, erratbaren Fallback-Wert, falls die Umgebungsvariable einmal nicht gesetzt war. Beide Routen brechen beim Start jetzt stattdessen mit einem Fehler ab, wenn `JWT_SECRET` fehlt, statt still auf einen unsicheren Wert zurückzufallen.
- Im Rahmen der Sicherheits-Härtung wurde das Secret rotiert (neuer zufälliger 128-Zeichen-Hex-Wert) — dadurch wurden alle zuvor ausgestellten Sessions/JWTs ungültig.

### Datenbankabfragen

Alle Datenbankabfragen verwenden parametrisierte Prepared Statements (better-sqlite3) — keine SQL-Injection möglich.

### Netzwerk & Firewall (Host-Ebene)

Auf dem Produktivserver ist **UFW** aktiv mit Default-Deny für eingehenden Traffic. Nur folgende Ports sind von außen erreichbar:

| Port | Dienst |
|---|---|
| 22 | SSH |
| 80 | HTTP (Nginx, Redirect auf HTTPS) |
| 443 | HTTPS (Nginx) |

Port `3001` (Node-Backend) ist **nicht** mehr direkt aus dem Internet erreichbar — nur noch über den Nginx-Reverse-Proxy. Zusätzlich (Defense in Depth) bindet der Express-Server in `backend/src/index.js` nur noch an `127.0.0.1` statt an `0.0.0.0`.

**SSH:** `X11Forwarding` ist serverweit deaktiviert. **fail2ban** ist serverweit installiert und aktiv (u.a. `sshd`-Jail) und schützt SSH gegen Brute-Force-Angriffe.

### Prozess-Isolation (Least Privilege)

Der pm2-Prozess `visitor-mgmt` läuft **nicht mehr als root**. Ein dedizierter, unprivilegierter Systembenutzer `svc-visitormgmt` wurde angelegt:

- Das gesamte Verzeichnis `/opt/visitor-mgmt` gehört `svc-visitormgmt`
- In `/opt/ecosystem.config.js` ist für den Eintrag von visitor-mgmt `uid: 'svc-visitormgmt'` und `gid: 'svc-visitormgmt'` gesetzt

### Dateiberechtigungen

| Pfad | Berechtigung | Eigentümer |
|---|---|---|
| `backend/.env` | `600` (vormals `644`, weltlesbar) | `svc-visitormgmt` |
| `backend/data/*.db`, `backups/*.db` | `640` | `svc-visitormgmt` |
| `logs/*.log` | `640` | `svc-visitormgmt` |

> Log- und DB-Dateien enthalten Klartext (Besuchernamen, Admin-E-Mails) und sind daher nicht mehr gruppen-/weltlesbar für andere Systembenutzer.

### Nginx-Härtung

Site-Konfiguration (`/etc/nginx/sites-available/visitor.luwilab.work`) und globale Konfiguration (`/etc/nginx/nginx.conf`):

- `ssl_protocols` global auf **TLSv1.2 und TLSv1.3** beschränkt (zuvor erlaubte die globale Konfiguration zusätzlich die veralteten Protokolle TLSv1/1.1)
- `server_tokens off` (global) — Nginx-Version wird nicht mehr in Response-Headern preisgegeben
- **Rate-Limiting auf Nginx-Ebene** (zusätzlich zum App-seitigen Rate-Limiting oben):
  - Zone `login_limit`: max. 5 Requests/Minute pro IP auf `/api/auth/`
  - Zone `api_limit`: max. 60 Requests/Minute pro IP auf den übrigen `/api/`-Pfaden
- `location ~ /\.git { deny all; }` als zusätzliche Absicherung

### Backups

`backup.sh` war schon zuvor logisch korrekt (Pfade stimmten), lief aber auf dem Server durch keinen Cron-Job/Timer — die Backups waren dadurch veraltet (16+ Tage alt). Es wurde ein Cron-Eintrag unter `/etc/cron.d/visitor-mgmt-backups` eingerichtet, der das Skript täglich um 02:00 Uhr als Benutzer `svc-visitormgmt` ausführt und nach `logs/backup.log` protokolliert. Details und Prüfbefehl siehe [Installationsanleitung → Datenbank-Backup](installation.md#datenbank-backup).

---

## 19. GDPR & Datenschutz

### Datenschutzerklärung-Unterschrift am Kiosk

Konfigurierbar unter **Einstellungen → Datenschutz:**

| Einstellung | Beschreibung |
|---|---|
| `privacy_policy_enabled` | Unterschrift am Kiosk erforderlich |
| `privacy_policy_text` | Vollständiger Datenschutztext (mehrzeilig, konfigurierbar) |

Ablauf: Besucher liest Text → unterschreibt mit Finger/Stift → PNG wird gespeichert → `privacy_policy_signed = 1`

### Automatische Anonymisierung

Besucher, deren letzter Check-in älter als N Tage und die keinen aktiven Visit haben:

```
first_name  → '[GELÖSCHT]'
last_name   → '[GELÖSCHT]'
email       → NULL
company     → NULL
photo_path  → NULL
```

Visit-Statistiken (Datum, Uhrzeit, Standort) bleiben erhalten. Die Spalte `phone` wurde aus `visitors` entfernt und ist daher auch aus der Bereinigungs-Query verschwunden.

**Manuelle Auslösung:** Einstellungen → Datenschutz → "Jetzt bereinigen"

### Admin-Löschrechte

Admins können Besucher, Vorregistrierungen und (bereits deaktivierte) Benutzer dauerhaft aus der Datenbank löschen (nicht nur anonymisieren/deaktivieren). Jede Löschung wird im Audit-Log protokolliert.

---

## 20. Infrastruktur & Deployment

### Prozessverwaltung (pm2)

Das Backend läuft im Produktivsystem unter **pm2** als Prozess `visitor-mgmt`.

```bash
# Erststart (aus dem backend-Verzeichnis, damit relative Pfade korrekt sind)
cd /opt/visitor-mgmt/backend
pm2 start src/index.js --name visitor-mgmt --cwd /opt/visitor-mgmt/backend
pm2 save                       # Prozessliste persistieren (überlebt Reboot)

# Alltag
pm2 restart visitor-mgmt       # nach Code- oder .env-Änderung
pm2 logs visitor-mgmt          # Live-Logs
pm2 list                       # Status aller Prozesse
```

> **Wichtig:** Nach jedem `git pull` und jeder `.env`-Änderung muss `pm2 restart visitor-mgmt`
> ausgeführt werden — sonst läuft weiter der alte Code bzw. die alte DB-Verbindung. Läuft der
> Prozess nicht, antwortet Nginx auf `/api`-Calls nicht und das Frontend zeigt generisch
> „Anmeldung fehlgeschlagen" (kein Hinweis auf falsche Zugangsdaten — das Backend ist schlicht down).

### Nginx

- HTTP (80) → HTTPS-Redirect
- HTTPS (443) mit Cloudflare Origin Certificate
- `/api/*` → Proxy zu `http://127.0.0.1:3001`
- `/` → React SPA aus `/opt/visitor-mgmt/frontend/dist`
- Gzip-Komprimierung, 1 Jahr Cache für statische Assets

---

## 21. SSL & Cloudflare

| Eigenschaft | Wert |
|---|---|
| Typ | Cloudflare Origin Certificate |
| Gültig bis | 11. Juni 2041 |
| Zertifikat | `/etc/ssl/visitor-mgmt/cert.pem` |
| Private Key | `/etc/ssl/visitor-mgmt/key.pem` |

Cloudflare muss auf **Full (Strict)** SSL gestellt sein.

---

## 22. Umgebungsvariablen (.env)

**Pfad:** `/opt/visitor-mgmt/backend/.env`

```env
# Pflicht
JWT_SECRET=<128-Byte zufälliger String>  # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
APP_URL=https://visitor.luwilab.work      # Öffentliche URL — kein abschließender Slash!

# Initialer Admin-Account (einmalig beim ersten Start, solange DB leer ist)
ADMIN_EMAIL=admin@firma.de
ADMIN_PASSWORD=<sicheres-passwort>
ADMIN_NAME=Administrator

PORT=3001
DB_PATH=/opt/visitor-mgmt/backend/data/visitors.db   # absoluten Pfad verwenden!

# E-Mail (optional — ohne SMTP werden Mails nur geloggt)
SMTP_HOST=<smtp-server>
SMTP_PORT=587
SMTP_USER=<smtp-benutzer>
SMTP_PASS=<smtp-passwort>
SMTP_SECURITY=starttls
FROM_EMAIL=<absender@firma.de>
COMPANY_NAME=<firmenname>

# Microsoft SSO (optional — nur wenn SSO genutzt werden soll)
MS_SSO_ENABLED=false
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=
```

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `JWT_SECRET` | **Ja** | Kryptografisch zufälliger 128-Byte-String |
| `APP_URL` | **Ja** | Öffentliche URL — wird für CORS verwendet |
| `ADMIN_EMAIL` | Ja (Erststart) | E-Mail des initialen Admins |
| `ADMIN_PASSWORD` | Ja (Erststart) | Passwort des initialen Admins |
| `PORT` | Nein | Backend-Port (Standard: 3001) |
| `DB_PATH` | Empfohlen | SQLite-Pfad. **Absoluten Pfad setzen** (`/opt/visitor-mgmt/backend/data/visitors.db`). Bei relativem Pfad (`./data/visitors.db`) hängt die genutzte DB vom Startverzeichnis ab — je nach pm2-/Cron-/Shell-cwd werden sonst versehentlich unterschiedliche DB-Dateien angelegt. |
| `SMTP_HOST` | Nein | SMTP-Server |
| `SMTP_USER` | Nein | SMTP-Benutzername |
| `SMTP_PASS` | Nein | SMTP-Passwort |
| `SMTP_SECURITY` | Nein | `starttls` / `ssl` / `none` (DB-Wert hat Vorrang) |
| `FROM_EMAIL` | Nein | Absender-Adresse |
| `COMPANY_NAME` | Nein | Firmenname (in Mails und Badge) |
| `MS_SSO_ENABLED` | Nein | Steuert nur, ob der "Mit Microsoft anmelden"-Button im Host-Portal eingeblendet wird — **nicht** den eigentlichen Login-Flow, siehe Warnhinweis unten |
| `MS_CLIENT_ID` | Nein | Nur für die Button-Sichtbarkeit relevant (s.u.) |
| `MS_CLIENT_SECRET` | Nein | Nur für die Button-Sichtbarkeit relevant (s.u.) |
| `MS_TENANT_ID` | Nein | Nur für die Button-Sichtbarkeit relevant (s.u.) |

> **⚠️ MS SSO ist derzeit nicht funktionsfähig ohne Zusatzarbeit:** Die `MS_SSO_*`-Variablen steuern ausschließlich, ob der Button auf `/host/login` angezeigt wird. Der tatsächliche OAuth-Flow in `host-portal.js` liest seine Konfiguration stattdessen aus `system_settings` (`ms_sso_enabled`, `ms_client_id`, `ms_client_secret`, `ms_tenant_id`) — dafür existiert aktuell keine Admin-UI. Details und Lösungsvorschlag siehe [Abschnitt 16](#16-host-portal). 2FA (für Admins) und AD-Sync (für Gastgeber) benötigen dagegen **keine** zusätzlichen `.env`-Variablen — beide sind vollständig über die Admin-UI (`system_settings`) konfigurierbar.

---

## 23. Wichtige Befehle

### Service-Verwaltung

```bash
pm2 list                            # Status aller Prozesse
pm2 restart visitor-mgmt            # nach git pull / .env-Änderungen
systemctl reload nginx
pm2 logs visitor-mgmt               # Live-Logs
pm2 logs visitor-mgmt --lines 100
```

### Frontend neu bauen

```bash
cd /opt/visitor-mgmt/frontend
npm run build
# Kein Nginx-Reload nötig — Nginx liest dist/ direkt
```

### Datenbank-Backup

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  ".backup /root/backup-$(date +%Y%m%d).db"
```

### Audit-Logs prüfen

```bash
ls /opt/visitor-mgmt/logs/
cat /opt/visitor-mgmt/logs/audit-$(date +%Y-%m-%d).log
```

### JWT-Secret neu generieren

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Wert in /opt/visitor-mgmt/backend/.env eintragen
pm2 restart visitor-mgmt
# Achtung: Alle aktiven Sessions werden invalidiert
```

### API testen

```bash
# Health Check
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@abat.de","password":"<passwort>"}'
```

---

## 24. Fehlerbehebung

### Backend startet nicht

```bash
pm2 logs visitor-mgmt --lines 50
cd /opt/visitor-mgmt/backend && node src/index.js  # detaillierter Fehler im Vordergrund
```

Häufige Ursachen: `.env` fehlt, Port 3001 belegt (`ss -tlnp | grep 3001`), fehlende Pakete (`npm install`),
Prozess gar nicht in pm2 registriert (`pm2 list` — fehlt `visitor-mgmt`, dann mit dem Startbefehl aus §20 anlegen),
oder better-sqlite3 kompiliert nicht unter neuer Node-Version (`npm install better-sqlite3@latest`).

### Weißer Bildschirm / Seite lädt nicht

```bash
cd /opt/visitor-mgmt/frontend && npm run build
# Prüfen ob Build-Fehler aufgetreten sind
```

Anschließend Hard-Reload im Browser: `Ctrl+Shift+R`.

### E-Mail wird nicht gesendet

1. SMTP-Test unter **Einstellungen → E-Mail → Test-E-Mail senden**
2. `.env` prüfen: `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`
3. Verschlüsselung prüfen (STARTTLS ↔ SSL je nach Provider)
4. Bei Gmail: App-Passwort verwenden (kein normales Passwort)
5. Nach `.env`-Änderung: `pm2 restart visitor-mgmt`

### Login schlägt fehl

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  "SELECT id, name, email, role, active, failed_login_attempts, locked_until, totp_enabled FROM users;"
```

Nach Änderung des JWT-Secrets müssen sich alle Nutzer neu einloggen.

**Account gesperrt** (`locked_until` gesetzt, Fehlermeldung "Account gesperrt..."): Nach 5 Fehlversuchen wird 15 Minuten gesperrt. Ein anderer Admin kann in **Einstellungen → Benutzer** vorzeitig entsperren, oder direkt per SQL:

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'admin@firma.de';"
```

**2FA-Code wird nicht akzeptiert / Zugriff auf Authenticator-App verloren:** Ein anderer Admin kann das 2FA des betroffenen Kontos über **Einstellungen → Benutzer** zurücksetzen (2FA muss danach neu eingerichtet werden). Ohne zweiten Admin-Zugang direkt per SQL:

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  "UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes = NULL WHERE email = 'admin@firma.de';"
```

> Da 2FA für `admin`-Konten verpflichtend ist, wird beim nächsten Login sofort wieder die Einrichtung (`/2fa-setup`) erzwungen.

### Benutzer sieht falsche Standortdaten

Standortzuweisungen in **Einstellungen → Benutzer** prüfen. Kein Eintrag = alle Standorte sichtbar.

### AD-Sync (Gastgeber-Synchronisierung) schlägt fehl

```bash
pm2 logs visitor-mgmt --lines 200 --nostream | grep ad-sync
```

Häufige Ursachen: falscher Bind-DN/-Passwort (LDAP-Bind-Fehler), Base-DN/Filter treffen keine Einträge, Netzwerk-/Firewall-Sperre zum AD-Server (Port meist 636 für LDAPS bzw. 389 für unverschlüsseltes LDAP), Zertifikatsproblem bei `ldaps://`. Über **Einstellungen → Gastgeber-Sync → Jetzt synchronisieren** wird die Fehlermeldung direkt im UI angezeigt (Backend antwortet bewusst mit `400`, nicht `502`, damit Cloudflare den Fehlertext nicht durch eine generische Seite ersetzt).

### SSL-Fehler

Cloudflare SSL-Modus muss **Full (Strict)** sein.

### Auto-Checkout funktioniert nicht

```bash
pm2 logs visitor-mgmt --lines 1000 --nostream | grep auto-checkout
```

Prüfen ob `auto_checkout_enabled = true` in den Einstellungen und ob die Uhrzeit korrekt als `HH:MM` eingetragen ist.

---

## 25. Netzwerk & Firewall-Freigaben

Das System folgt dem Minimal-Prinzip: Es gibt **keine Abhängigkeit von externen CDNs oder Telemetrie-Diensten** zur Laufzeit. Alle npm-Pakete sind lokal installiert, Schriften sind lokal eingebettet.

### Einmalig (Build-/Setup-Zeit)

Diese Verbindungen werden **nur während der Installation** benötigt und können danach gesperrt bleiben.

| Zweck | Domain | Port | Protokoll |
|---|---|---|---|
| npm-Pakete installieren (Frontend + Backend) | `registry.npmjs.org` | 443 | HTTPS |
| Node.js installieren (falls über NodeSource) | `deb.nodesource.com` | 443 | HTTPS |
| Repository klonen | `github.com` | 443 | HTTPS |

### Laufender Betrieb (dauerhaft freischalten)

| Zweck | Host / Domain | Port | Protokoll | Konfigurierbar? |
|---|---|---|---|---|
| SMTP (ausgehende E-Mail) | euer SMTP-Server (z.B. `smtp.firma.de`) | 465 oder 587 | SMTP+SSL/STARTTLS | Ja, in `.env` / Einstellungen |

### Nicht vorhanden / kein Bedarf

| Was | Warum keine Freigabe nötig |
|---|---|
| Google Fonts / Font-CDN | Mulish-Schrift liegt **lokal** unter `/frontend/public/fonts/` |
| jsDelivr, unpkg, cdnjs | Keine CDN-Script-Einbindungen — alles im Build gebündelt |
| Telemetrie / Analytics | Keine vorhanden |
| npm zur Laufzeit | Keine Update-Checks oder Laufzeit-Downloads |
| `github.com` / `scanapp.org` | Nur als statische `href`-Links im QR-Scanner-UI — werden **nicht** automatisch aufgerufen |

### Zusammenfassung für den Firewall-Admin

```
# Nur einmalig (Setup):
registry.npmjs.org:443
deb.nodesource.com:443
github.com:443

# Dauerhaft (Laufzeit) — nur intern/konfiguriert:
<SMTP-Server>:465 oder 587     # E-Mail-Versand
```

Eingehend benötigt der Server nur HTTPS (443) von Cloudflare und ggf. SSH (22) für Administration.

---

## Dateipfade auf einen Blick

| Was | Pfad |
|---|---|
| Projekt-Root | `/opt/visitor-mgmt/` |
| Backend-App | `/opt/visitor-mgmt/backend/src/index.js` |
| Datenbank | `/opt/visitor-mgmt/backend/data/visitors.db` |
| Umgebungsvariablen | `/opt/visitor-mgmt/backend/.env` |
| Uploads | `/opt/visitor-mgmt/backend/uploads/` |
| Audit-Logs | `/opt/visitor-mgmt/logs/` |
| Frontend-Build | `/opt/visitor-mgmt/frontend/dist/` |
| Nginx-Konfiguration | `/etc/nginx/sites-available/visitor.luwilab.work` |
| SSL-Zertifikat | `/etc/ssl/visitor-mgmt/cert.pem` |
| Prozessmanager | pm2 — Prozess `visitor-mgmt` (`pm2 list`, Dump in `/root/.pm2/dump.pm2`) |
| Dokumentation | `/opt/visitor-mgmt/docs/` |
| Assets (Logos, Font) | `/opt/visitor-mgmt/assets/` |
