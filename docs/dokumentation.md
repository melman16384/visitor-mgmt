# Besucherverwaltungssystem — Projektdokumentation

> Erstellt: 15. Juni 2026 | Zuletzt aktualisiert: 15. Juni 2026 (Session 2)  
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
9. [abat-ID](#9-abat-id)
10. [Dokumenten-Upload & Unterschrift](#10-dokumenten-upload--unterschrift)
11. [Zugangsdaten & Benutzerrollen](#11-zugangsdaten--benutzerrollen)
12. [Standortbasierte Zugriffskontrolle](#12-standortbasierte-zugriffskontrolle)
13. [Badge-Drucker (Brother QL-820NWB)](#13-badge-drucker-brother-ql-820nwb)
14. [E-Mail-System](#14-e-mail-system)
15. [GDPR & Datenschutz](#15-gdpr--datenschutz)
16. [Infrastruktur & Deployment](#16-infrastruktur--deployment)
17. [SSL & Cloudflare](#17-ssl--cloudflare)
18. [Umgebungsvariablen (.env)](#18-umgebungsvariablen-env)
19. [Wichtige Befehle](#19-wichtige-befehle)
20. [Fehlerbehebung](#20-fehlerbehebung)

---

## 1. Projektübersicht

Ein vollständiges, webbasiertes Besucherverwaltungssystem für Unternehmen. Besucher können am Empfang oder per Kiosk-Modus ein- und ausgecheckt werden. Das System unterstützt Vorregistrierungen, Badge-Druck (PDF + Etikettendrucker), Evakuierungslisten, Berichte und standortbasierte Zugriffskontrolle.

### Features im Überblick

| Feature | Beschreibung |
|---|---|
| Check-in / Check-out | Walk-in, Kamera-QR-Scan oder Vorregistrierung; auch manuell im Dashboard |
| Vorregistrierung | Gastgeber kann Besucher voranmelden, QR-Code per E-Mail; Gruppenregistrierung |
| QR-Code Vorregistrierung | Server-seitig generiert (kein externer Dienst), Anzeige im Admin-Modal |
| Badge-Generierung | A6-PDF (Landscape) mit Name, Firma, Gastgeber, QR-Code, Parkplatz |
| Badge-Drucker | Brother QL-820NWB über IP (RAW TCP Port 9100), DK-11202 (62×100 mm) |
| abat-ID | Permanente Besucher-ID im Format `ABAT-########` (8 Ziffern, einzigartig); in E-Mail + Kiosk-Erfolgsscreen |
| Kiosk-Modus | 3 Optionen: Einchecken, Auschecken, Erstanmeldung — kein Login nötig |
| Kiosk Check-in Flow | Mehrstufig: QR-Scan oder abat-ID → Daten bestätigen → Datenschutz unterschreiben → Erfolg |
| Datenschutzerklärung | Unterschrift am Kiosk mit Finger/Stift (signature_pad); Text konfigurierbar im Admin |
| Mehrsprachiger Kiosk | Deutsch / Englisch, umschaltbar per Sprachbutton |
| Kennzeichen & Parkplatz | Kennzeichen und Parkplatz bei Check-in und Vorregistrierung erfassbar |
| Kamera-QR-Scanner | Echter Kamera-Scan (kein manuelles Eingeben); robuster Stop-Guard verhindert Doppel-Stop-Fehler |
| Dokumenten-Upload | PDF/DOC hochladen + digitale Unterschrift (Canvas) |
| Evakuierungsliste | Echtzeit, nach Standort gruppiert, druckoptimiert, 30 s Auto-Refresh |
| Berichte & Export | Tages-/Monatsberichte, CSV-Export |
| E-Mail-Benachrichtigungen | Gastgeber bei Ankunft, Besucher Check-in-Bestätigung, QR-Code bei Vorregistrierung |
| E-Mail-Test | Test-E-Mail über konfigurierte SMTP-Einstellungen direkt aus dem Admin |
| SMTP-Verschlüsselung | STARTTLS / SSL/TLS / Keine — konfigurierbar im Admin |
| Mehrere Standorte | Unterstützung für mehrere Firmenstandorte |
| Standortbasierte Zugriffskontrolle | Empfang-Benutzer können auf bestimmte Standorte beschränkt werden |
| Benutzerverwaltung | Anlegen, Bearbeiten, Deaktivieren von Benutzern im Admin (superadmin) |
| Besuchsgrundauswahl | Konfigurierbare Besuchszwecke im Admin (wie Standorte / Gastgeber) |
| Parkplatzverwaltung | Parkplätze anlegen, Belegungsstatus in Echtzeit |
| Rollenverwaltung | superadmin / admin / receptionist |
| GDPR-Datenlöschung | Automatische Anonymisierung nach konfigurierbaren Tagen |
| abat AG CI | Logo, Mulish-Schrift, Markenfarben durchgängig |

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
   ├── /api/       → http://127.0.0.1:3001            (Node.js Backend)
   └── /uploads/   → http://127.0.0.1:3001            (Besucherfotos)
   
Node.js Backend (Port 3001)
   └── better-sqlite3 → /opt/visitor-mgmt/backend/data/visitors.db

Brother QL-820NWB (Etikettendrucker)
   └── RAW TCP Port 9100 (im lokalen Netzwerk erreichbar)
```

**Tech Stack:**
- **Frontend:** React 18 + Vite + Tailwind CSS + Mulish Font
- **Backend:** Node.js + Express.js
- **Datenbank:** SQLite (better-sqlite3)
- **Auth:** JWT (JSON Web Tokens, 8h Gültigkeit)
- **PDF:** PDFKit (Badge-Generierung A6 Landscape)
- **Etikettendruck:** canvas + net.Socket (Brother QL Raster Protocol)
- **QR-Codes:** qrcode (Generierung) + html5-qrcode (Kamera-Scanner)
- **Unterschrift:** signature_pad (Canvas-basiert)
- **Datei-Upload:** multer (Fotos + Dokumente)
- **E-Mail:** Nodemailer (SMTP, STARTTLS/SSL/Keine konfigurierbar)
- **Webserver:** Nginx 1.24
- **SSL:** Cloudflare Origin Certificate (gültig bis 2041)
- **Prozessmanager:** systemd

---

## 4. Verzeichnisstruktur

```
/opt/visitor-mgmt/
│
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js          # SQLite-Initialisierung & Schema
│   │   │   └── seed.js              # Testdaten
│   │   ├── middleware/
│   │   │   └── auth.js              # JWT-Middleware, requireRole(), location_ids laden
│   │   ├── routes/
│   │   │   ├── auth.js              # Login, /me, Passwort ändern
│   │   │   ├── dashboard.js         # Stats, Chart-Daten, Recent visits
│   │   │   ├── visitors.js          # CRUD Besucher + Check-in (standortgefiltert)
│   │   │   ├── visits.js            # Check-out, Checkout per QR, Namenssuche
│   │   │   ├── documents.js         # Dokument-Upload + Unterschrift
│   │   │   ├── hosts.js             # CRUD Gastgeber (GET public)
│   │   │   ├── preregistrations.js  # Vorregistrierung + Batch + QR-Versand
│   │   │   ├── locations.js         # CRUD Standorte
│   │   │   ├── visit-purposes.js    # CRUD Besuchszwecke (GET public)
│   │   │   ├── parking.js           # CRUD Parkplätze + Belegungsstatus (GET public)
│   │   │   ├── users.js             # CRUD Benutzer + Standortzuweisung (superadmin)
│   │   │   ├── settings.js          # System-Settings, GDPR-Cleanup, E-Mail-Test
│   │   │   └── reports.js           # Berichte, Evakuierung (standortgefiltert), CSV
│   │   ├── services/
│   │   │   ├── badge.js             # PDF-Badge Generierung (PDFKit, A6 Landscape)
│   │   │   ├── label-printer.js     # Brother QL-820NWB RAW TCP Etikettendruck
│   │   │   ├── qrcode.js            # QR-Code als Buffer oder DataURL
│   │   │   └── email.js             # Nodemailer: alle ausgehenden Mails
│   │   └── index.js                 # Express App, Port 3001
│   ├── data/
│   │   └── visitors.db              # SQLite-Datenbank (NICHT löschen!)
│   ├── uploads/
│   │   ├── documents/               # Hochgeladene Dokumente (PDF/DOC)
│   │   └── signatures/              # Unterschriften als PNG
│   ├── .env                         # Produktionskonfiguration
│   └── package.json
│
└── frontend/
    ├── public/
    │   ├── logo-dark.png
    │   ├── logo-light.png
    │   └── fonts/
    ├── src/
    │   ├── api/client.js            # Axios-Instanz, 401-Redirect (kiosk-aware)
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   ├── Sidebar.jsx          # Navigation (ohne Sperrliste)
    │   │   ├── Modal.jsx
    │   │   ├── QRScanner.jsx
    │   │   ├── SignaturePad.jsx
    │   │   └── DocumentSigning.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── KioskLangContext.jsx  # DE/EN Übersetzungen für Kiosk
    │   └── pages/
    │       ├── Login.jsx
    │       ├── Dashboard.jsx
    │       ├── Visitors.jsx         # Tabs: Alle / Angekündigt / Aktiv / Verlassen
    │       ├── KioskStart.jsx       # Mit Sprachschalter DE/EN
    │       ├── KioskCheckin.jsx
    │       ├── KioskCheckout.jsx
    │       ├── KioskManual.jsx      # Mit Kennzeichen + Parkplatz
    │       ├── Hosts.jsx
    │       ├── PreRegistration.jsx  # Mit Gruppenregistrierung + Kennzeichen
    │       ├── Evacuation.jsx       # Nach Standort gruppiert, druckoptimiert
    │       ├── Reports.jsx
    │       └── Settings.jsx         # Standorte, Besuchszwecke, Parkplätze,
    │                                #  Benutzer, Etikettendrucker, Datenschutz,
    │                                #  E-Mail (inkl. Verschlüsselung + Test)
    ├── dist/                        # Produktions-Build
    └── package.json
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
| role | TEXT | `superadmin` / `admin` / `receptionist` |
| active | INTEGER | 1 = aktiv, 0 = deaktiviert |
| created_at | DATETIME | |

#### `user_locations` — Standortzuweisung für Benutzer (many-to-many)
| Spalte | Typ | Beschreibung |
|---|---|---|
| user_id | INTEGER PK | FK → users (CASCADE DELETE) |
| location_id | INTEGER PK | FK → locations (CASCADE DELETE) |

> Kein Eintrag = Benutzer sieht alle Standorte. Mit Einträgen: nur zugewiesene Standorte.

#### `locations` — Standorte
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | z.B. "Bremen", "Heidelberg" |
| address | TEXT | Straße & Hausnummer |
| city | TEXT | Stadt |
| active | INTEGER | |

#### `hosts` — Gastgeber
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| email | TEXT | Für Benachrichtigungen |
| phone | TEXT | |
| department | TEXT | Abteilung |
| location_id | INTEGER | FK → locations |
| active | INTEGER | Soft-Delete |

#### `visitors` — Besucherstammdaten
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| abat_id | TEXT UNIQUE | Permanente Besucher-ID, Format `ABAT-########` (8 Ziffern) |
| first_name | TEXT | |
| last_name | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| company | TEXT | |
| nda_signed | INTEGER | 0 / 1 |
| nda_signed_at | DATETIME | |
| created_at | DATETIME | |

> `abat_id` wird beim ersten Check-in automatisch generiert (einzigartiger Index `idx_visitors_abat_id`). Bestehende Besucher erhalten beim ersten Serverstart nach dem Update eine ID per Backfill.

#### `visits` — Einzelne Besuche
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visitor_id | INTEGER | FK → visitors |
| host_id | INTEGER | FK → hosts |
| location_id | INTEGER | FK → locations |
| purpose | TEXT | Besuchszweck |
| badge_number | TEXT | Eindeutige Badge-Nummer (B-XXXXX) |
| qr_code | TEXT | QR-Code-Inhalt |
| checked_in_at | DATETIME | |
| checked_out_at | DATETIME | NULL wenn noch anwesend |
| expected_checkout | DATETIME | |
| notes | TEXT | |
| status | TEXT | `active` / `completed` |
| license_plate | TEXT | Kennzeichen (optional) |
| parking_spot | TEXT | Parkplatznummer (optional) |
| privacy_policy_signed | INTEGER | 0 / 1 — Datenschutzerklärung unterzeichnet |
| privacy_policy_signature_path | TEXT | Dateiname der Unterschrift-PNG in `/uploads/signatures/` |

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
| expected_date | DATE | |
| expected_time | TIME | |
| purpose | TEXT | |
| qr_code | TEXT UNIQUE | |
| status | TEXT | `pending` / `checked_in` / `expired` / `cancelled` |
| notes | TEXT | |
| license_plate | TEXT | Kennzeichen (optional) |
| group_id | TEXT | Gruppen-ID bei Sammelregistrierung (optional) |

#### `visit_purposes` — Besuchszwecke (konfigurierbar)
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT UNIQUE | z.B. "Besprechung", "Lieferung" |
| sort_order | INTEGER | Reihenfolge |
| active | INTEGER | |

Standardwerte: Besprechung, Lieferung, Interview, Wartung, Sonstiges

#### `parking_spots` — Parkplätze
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT UNIQUE | z.B. "P1", "Tiefgarage A" |
| sort_order | INTEGER | |
| active | INTEGER | |

#### `system_settings` — Systemkonfiguration (key/value)
| Key | Standardwert | Beschreibung |
|---|---|---|
| `gdpr_retention_days` | `365` | Tage bis zur Anonymisierung |
| `visitor_email_confirmation` | `true` | Check-in-Bestätigung an Besucher |
| `printer_enabled` | `false` | Etikettendrucker aktiv |
| `printer_ip` | `` | IP-Adresse des Brother QL-820NWB |
| `printer_port` | `9100` | TCP-Port des Druckers |
| `smtp_security` | `starttls` | SMTP-Verschlüsselung: `starttls` / `ssl` / `none` |
| `privacy_policy_text` | *(Platzhaltertext)* | Datenschutztext — im Kiosk angezeigt und zur Unterschrift vorgelegt |
| `privacy_policy_enabled` | `true` | Datenschutz-Unterschrift im Kiosk aktivieren / deaktivieren |

#### `visit_documents` — Hochgeladene Dokumente & Unterschriften
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | INTEGER PK | |
| visit_id | INTEGER | FK → visits |
| filename | TEXT | Gespeicherter Dateiname (UUID-basiert) |
| original_name | TEXT | Originaler Dateiname |
| document_type | TEXT | `nda` / `sonstiges` |
| signature_path | TEXT | PNG-Dateiname in `/uploads/signatures/` |
| signed_at | DATETIME | |

---

## 6. Backend API

**Base URL:** `https://visitor.luwilab.work/api`  
**Auth:** `Authorization: Bearer <JWT-Token>` (außer explizit als öffentlich markiert)  
**Token-Gültigkeit:** 8 Stunden

### Authentifizierung

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/auth/login` | Nein | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Ja | Aktueller Benutzer |
| PUT | `/auth/change-password` | Ja | Passwort ändern |

### Dashboard

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/dashboard/stats` | Kennzahlen: heute, aktuell, Woche, Monat |
| GET | `/dashboard/recent` | Letzte 10 Besuche |
| GET | `/dashboard/chart` | Besuche pro Tag, letzte 14 Tage |

### Besucher (standortgefiltert für Receptionist)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/visitors` | Ja | Liste (?search=, ?status=, ?page=) — gefiltert |
| POST | `/visitors` | **Nein** | Neu erstellen + einchecken (Kiosk-kompatibel) |
| GET | `/visitors/active` | Ja | Aktuell anwesend — gefiltert |
| GET | `/visitors/:id` | Ja | Details + Besuchshistorie |
| PUT | `/visitors/:id` | Ja | Stammdaten bearbeiten |
| POST | `/visitors/:id/checkin` | Ja | Erneut einchecken |
| GET | `/visitors/:id/badge/:visitId` | Ja | Badge als PDF |
| POST | `/visitors/:id/print-badge/:visitId` | Ja | Badge an Etikettendrucker senden |
| POST | `/visitors/printer-test` | Ja | TCP-Verbindung zum Drucker testen |

### Besuche (Check-out)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/visits/:id/checkout` | Ja | Besucher auschecken |
| POST | `/visits/checkout-by-qr` | **Nein** | Kiosk: Auschecken per Badge-QR |
| POST | `/visits/checkout-by-abat-id` | **Nein** | Kiosk: Auschecken per abat-ID `{ abat_id }` |
| GET | `/visits/search-active` | **Nein** | Kiosk: Aktive Besuche nach Name suchen |

### Vorregistrierungen

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/preregistrations` | Ja | Liste (?date_filter=, ?status=) |
| POST | `/preregistrations` | Ja | Einzelne Vorregistrierung + QR per E-Mail |
| POST | `/preregistrations/batch` | Ja | Gruppenregistrierung (mehrere Gäste, gemeinsame group_id) |
| PUT | `/preregistrations/:id` | Ja | Bearbeiten |
| DELETE | `/preregistrations/:id` | Ja | Stornieren |
| GET | `/preregistrations/qr-image/:qrcode` | **Nein** | QR-Code als PNG-Bild (server-seitig generiert) |
| GET | `/preregistrations/qr/:qrcode` | **Nein** | Kiosk: Infos via QR-Code |
| POST | `/preregistrations/qr/:qrcode/checkin` | **Nein** | Kiosk: Einchecken via QR (+ optionale Unterschrift und korrigierte Daten) |
| GET | `/preregistrations/by-abat-id/:abatId` | **Nein** | Kiosk: Vorregistrierung per abat-ID abrufen |

### Gastgeber

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/hosts` | **Nein** | Liste (öffentlich für Kiosk) |
| POST | `/hosts` | Ja | Erstellen |
| PUT | `/hosts/:id` | Ja | Bearbeiten |
| DELETE | `/hosts/:id` | Ja | Soft-Delete |

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
| GET | `/visit-purposes` | **Nein** | Alle aktiven Zwecke (für Kiosk) |
| POST | `/visit-purposes` | Ja | Erstellen |
| PUT | `/visit-purposes/:id` | Ja | Bearbeiten |
| DELETE | `/visit-purposes/:id` | Ja | Löschen |

### Parkplätze

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/parking` | **Nein** | Alle Plätze inkl. `occupied`-Flag (für Kiosk) |
| POST | `/parking` | Ja | Erstellen |
| PUT | `/parking/:id` | Ja | Bearbeiten |
| DELETE | `/parking/:id` | Ja | Löschen |

### Benutzer (nur superadmin)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/users` | Alle Benutzer inkl. `location_ids[]` |
| POST | `/users` | Erstellen (mit `location_ids[]`) |
| PUT | `/users/:id` | Bearbeiten (mit `location_ids[]`) |
| POST | `/users/:id/reset-password` | Passwort zurücksetzen |
| DELETE | `/users/:id` | Deaktivieren (Soft-Delete) |

### Einstellungen (admin+)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/settings/system` | Ja (admin+) | Alle system_settings |
| PUT | `/settings/system` | Ja (admin+) | Einstellungen speichern (inkl. `privacy_policy_text`, `privacy_policy_enabled`) |
| GET | `/settings/smtp-config` | Ja (admin+) | Aktuelle SMTP-Konfiguration aus `.env` (Passwort maskiert) |
| GET | `/settings/privacy-policy` | **Nein** | Datenschutztext + enabled-Flag (für Kiosk) |
| POST | `/settings/email-test` | Ja (admin+) | Test-E-Mail senden `{ to: "..." }` |
| POST | `/settings/gdpr/cleanup` | Ja (admin+) | GDPR-Bereinigung ausführen |

### Berichte (standortgefiltert)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/reports/daily?date=YYYY-MM-DD` | Tagesbericht |
| GET | `/reports/monthly?year=YYYY&month=MM` | Monatsbericht |
| GET | `/reports/evacuation` | Evakuierungsliste — gruppiert nach Standort |
| GET | `/reports/export?from=&to=&format=csv` | CSV-Export |

### Dokumenten-Upload & Unterschrift

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/visits/:visitId/documents` | Nein* | Dokument hochladen |
| POST | `/documents/:docId/signature-base64` | Nein* | Unterschrift speichern |
| GET | `/visits/:visitId/documents` | Ja | Dokumente abrufen |
| GET | `/documents/:docId/download` | Ja | Dokument herunterladen |

---

## 7. Frontend & Seiten

| Route | Seite | Auth | Beschreibung |
|---|---|---|---|
| `/login` | Login | Nein | |
| `/kiosk` | KioskStart | **Nein** | Sprachschalter DE/EN |
| `/kiosk/checkin` | KioskCheckin | **Nein** | QR-Scan |
| `/kiosk/checkout` | KioskCheckout | **Nein** | QR oder Namenssuche |
| `/kiosk/manual` | KioskManual | **Nein** | Walk-in mit Kennzeichen + Parkplatz |
| `/dashboard` | Dashboard | Ja | Kennzahlen, Diagramm |
| `/visitors` | Besucher | Ja | Tabs: Alle / Angekündigt / Aktiv / Verlassen |
| `/hosts` | Gastgeber | Ja | |
| `/preregistrations` | Vorregistrierung | Ja | Einzel- und Gruppenregistrierung |
| `/evacuation` | Evakuierung | Ja | Nach Standort gruppiert, Drucklayout |
| `/reports` | Berichte | Ja | |
| `/settings` | Einstellungen | Ja (admin+) | Alle Konfigurations-Tabs |

### Einstellungs-Tabs (Settings.jsx)

| Tab | Inhalt |
|---|---|
| Standorte | CRUD Standorte |
| Besuchszwecke | CRUD Besuchszwecke |
| Parkplätze | CRUD Parkplätze mit Belegungsanzeige |
| Benutzer | CRUD Benutzer + Standortzuweisung (nur superadmin) |
| Etikettendrucker | IP, Port, Aktivierung, Verbindungstest |
| Datenschutz | GDPR Aufbewahrungsdauer, Bereinigung, E-Mail-Bestätigung |
| E-Mail | SMTP-Konfiguration (read-only aus .env), Verschlüsselung (STARTTLS/SSL/Keine), Test-E-Mail |
| Passwort ändern | Eigenes Passwort ändern |

### Dashboard (Dashboard.jsx)

- **"Einchecken"-Button** oben rechts öffnet ein Quick-Check-in-Modal mit Name, Unternehmen, Gastgeber, Besuchsgrund
- **Letzte Besuche**-Tabelle zeigt jetzt die `abat-ID` als eigene Spalte (blau highlighted, Monospace-Schrift)
- **Suche** in der Tabelle filtert nach Name, Firma und abat-ID
- Auschecken per Button direkt in der Zeile (bereits vorher vorhanden)

### Besucherliste (Visitors.jsx) — Tabs

| Tab | Datenquelle | Beschreibung |
|---|---|---|
| Alle | `GET /visitors` | Alle Besucher mit letztem aktiven Visit |
| Angekündigt | `GET /preregistrations?status=pending` | Vorregistriert, noch nicht eingecheckt |
| Aktiv | `GET /visitors?status=active` | Aktuell im Gebäude |
| Bereits verlassen | `GET /visitors?status=completed` | Heute ausgecheckt |

Die Tabelle zeigt eine `abat-ID`-Spalte für alle Tabs außer "Angekündigt".

**Aktionsbuttons pro Zeile:**
- PDF-Badge herunterladen (FileText)
- Badge an Etikettendrucker senden (Printer) — nur wenn Drucker aktiviert
- Auschecken (LogOut) — nur bei aktiven Visits

---

## 8. Kiosk-System

Läuft ohne Login, ausgelegt für Tablets am Empfang. Alle Kiosk-Routen sind öffentlich.

### Mehrsprachigkeit

Der Kiosk unterstützt Deutsch und Englisch. Die Sprache wird per `localStorage` (Key: `kiosk_lang`) gespeichert. Umschalter erscheint im Header der Kiosk-Startseite (🇩🇪 DE / 🇬🇧 EN).

Implementiert in: `frontend/src/context/KioskLangContext.jsx`

### Check-in Flow (`/kiosk/checkin`) — Mehrstufig

Der Kiosk-Check-in läuft als State-Machine mit vier Stufen:

```
scan → confirm → privacy → success
               ↘ (wenn Datenschutz deaktiviert) → success
```

| Stufe | Inhalt |
|---|---|
| **scan** | QR-Code per Kamera scannen **oder** abat-ID eingeben (`ABAT-` fest vorausgefüllt, nur Ziffern) |
| **confirm** | Vorregistrierungsdaten anzeigen und ggf. korrigieren (Vorname, Nachname, Unternehmen); Gastgeber read-only |
| **privacy** | Scrollbarer Datenschutztext (aus Admin konfiguriert) + Unterschriftsfeld (finger/Stift); Button erst nach Unterschrift aktiv |
| **success** | abat-ID groß angezeigt, Gastgeber, Badge-Nr.; automatischer Rücksprung nach 6 Sekunden |

Der Datenschutz-Schritt wird übersprungen, wenn `privacy_policy_enabled = false` in den Systemeinstellungen.

### abat-ID Eingabe (Kiosk Check-in & Check-out)

- `ABAT-` als statisches, nicht bearbeitbares Präfix angezeigt (grauer Kasten links)
- Nur die 8 Ziffern werden eingegeben
- Auto-Submit bei 8 Ziffern — kein Bestätigen-Button nötig
- Ziffernzähler (z.B. `5/8 Ziffern`) zur Orientierung
- Implementiert als `AbatIdInput`-Komponente in `KioskCheckin.jsx` und `KioskCheckout.jsx`

### Datenschutzerklärung-Unterschrift

- Text konfigurierbar unter **Einstellungen → Datenschutz** (freies Textfeld)
- Anzeige im Kiosk als scrollbarer Block
- Unterschrift via `signature_pad`-Bibliothek (Canvas, Touch/Maus)
- Besucher unterschreibt mit Finger oder Stift auf dem Tablet
- Unterschrift-PNG wird als Base64 übertragen, serverseitig als Datei gespeichert
- Speicherort: `/backend/uploads/signatures/privacy-<timestamp>-<random>.png`
- Pfad wird in `visits.privacy_policy_signature_path` gespeichert
- Flag `visits.privacy_policy_signed` wird auf `1` gesetzt

### Check-out (`/kiosk/checkout`) — 3 Tabs

| Tab | Methode |
|---|---|
| QR-Code scannen | Kamera scannt Badge-QR → `POST /visits/checkout-by-qr` |
| abat-ID | `ABAT-` Präfix vorausgefüllt, 8 Ziffern → `POST /visits/checkout-by-abat-id` |
| Name suchen | Freitext-Suche → `GET /visits/search-active` → Auswahl → Check-out |

### Erfolgsscreen nach Check-in (KioskManual + KioskCheckin)

Nach erfolgreichem Check-in wird angezeigt:
- **abat-ID** — groß, blau, prominent (`ABAT-########`)
- Badge-Nummer
- Gastgeber (bei QR-Check-in)
- Parkplatz (falls vergeben)
- Automatischer Rücksprung zur Startseite nach 6-Sekunden-Countdown

### Erstanmeldung (`/kiosk/manual`)

Formularfelder:
- Vorname *, Nachname *, Gastgeber * (Dropdown)
- Unternehmen, Besuchszweck (Dropdown — aus konfigurierbaren Zwecken)
- Kennzeichen (Auto-Uppercase), Parkplatz (Dropdown mit Belegungsanzeige)
- Notizen

### Breiten (alle Kiosk-Seiten)

Alle Kiosk-Seiten wurden auf breitere Container umgestellt:

| Bereich | Klasse | Breite |
|---|---|---|
| Erfolgs-/Fehler-Screens | `max-w-xl` | 576 px |
| Formulare / Inhalts-Bereiche | `max-w-2xl` | 672 px |
| Login-Seite | `max-w-xl` | 576 px |

### QR-Scanner — Technische Besonderheit

`QRScanner.jsx` verwendet `html5-qrcode`. Beim erfolgreichen Scan wurde `scanner.stop()` bisher zweimal aufgerufen (einmal im Callback, einmal im Cleanup des `useEffect`), was zu einem synchronen Fehler und weißem Bildschirm führen konnte.

**Fix:** `stoppedRef`-Flag (`useRef(false)`) verhindert Doppel-Aufrufe. `safeStop()` prüft das Flag vor jedem `stop()`-Aufruf; alle `stop()`-Aufrufe sind zusätzlich mit `try/catch` + `.catch(() => {})` abgesichert.

---

## 9. abat-ID

Jeder Besucher erhält eine permanente, einzigartige Kennung im Format `ABAT-########` (8 zufällige Ziffern, 0–9).

### Eigenschaften

| Eigenschaft | Wert |
|---|---|
| Format | `ABAT-00000000` bis `ABAT-99999999` |
| Speicherort | Spalte `abat_id` in Tabelle `visitors` (UNIQUE INDEX `idx_visitors_abat_id`) |
| Vergabe | Bei **Vorregistrierung** (wenn E-Mail angegeben) oder spätestens beim ersten Check-in |
| Beständigkeit | Permanent — bleibt bei allen späteren Besuchen gleich |
| Kollisionsprüfung | Schleife: neue ID generieren, bis keine Kollision in der DB |

### Vergabe-Zeitpunkt

Die abat-ID wird so früh wie möglich vergeben:

| Situation | Zeitpunkt der Vergabe |
|---|---|
| Vorregistrierung mit E-Mail | Sofort beim Erstellen der Vorregistrierung (`getOrCreateVisitor()`) |
| Vorregistrierung ohne E-Mail | Beim Einchecken am Kiosk |
| Walk-in / Manueller Check-in | Beim Erstellen des Besucher-Datensatzes |

Dadurch ist die abat-ID **bereits in der Einladungs-E-Mail** enthalten und kann als Fallback genutzt werden.

### Anzeige

| Ort | Darstellung |
|---|---|
| Vorregistrierungs-E-Mail | Als Box mit blauem Rand, Monospace-Schrift, prominent |
| Kiosk-Erfolgsscreen (Manual + QR) | Groß, blau, prominente Anzeige direkt nach Check-in |
| Dashboard (Letzte Besuche) | Eigene Spalte, Monospace-Schrift, blau hinterlegt |
| Besucherliste (Visitors) | Eigene Spalte (außer Tab "Angekündigt") |

### Backfill

Beim ersten Serverstart nach der Migration werden alle bestehenden Besucher ohne `abat_id` automatisch mit einer einzigartigen ID versorgt (Backfill in `database.js`).

### Nutzung als Fallback zum QR-Code

- Am Kiosk-Check-in: abat-ID eintippen (nur 8 Ziffern, `ABAT-` vorausgefüllt) → automatisches Suchen → Daten bestätigen → Unterschreiben → Check-in
- Am Kiosk-Check-out: Tab "abat-ID" — gleiche Eingabelogik
- Am Empfang: Besucher telefonisch identifizieren; in Besucherliste + Dashboard suchbar

---

## 10. Dokumenten-Upload & Unterschrift

Ablauf: Besucher einchecken → Dokument hochladen (optional) → Unterschrift leisten (optional).

Technische Details: PDF/DOC/DOCX, max. 20 MB, Unterschrift als PNG.  
Speicherorte: `/backend/uploads/documents/` und `/backend/uploads/signatures/`

---

## 11. Zugangsdaten & Benutzerrollen

### Produktions-Accounts (abat AG)

| Name | E-Mail | Passwort | Rolle |
|---|---|---|---|
| Administrator | `admin@abat.de` | `REDACTED` | superadmin |
| Empfang | `empfang@abat.de` | `REDACTED` | receptionist |

Passwörter sind gespeichert in: `/root/visitor-mgmt-credentials.txt`

### Rollen & Berechtigungen

| Berechtigung | superadmin | admin | receptionist |
|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ |
| Besucher verwalten | ✓ | ✓ | ✓ (standortgefiltert) |
| Gastgeber verwalten | ✓ | ✓ | ✓ |
| Vorregistrierungen | ✓ | ✓ | ✓ |
| Evakuierungsliste | ✓ | ✓ | ✓ (standortgefiltert) |
| Berichte | ✓ | ✓ | ✗ |
| Einstellungen | ✓ | ✓ | ✗ |
| Benutzer verwalten | ✓ | ✗ | ✗ |

---

## 12. Standortbasierte Zugriffskontrolle

Benutzer (insbesondere Receptionist) können auf bestimmte Standorte beschränkt werden.

### Funktionsweise

1. In **Einstellungen → Benutzer** werden einem Benutzer ein oder mehrere Standorte zugewiesen (Checkboxen im Modal)
2. Die Zuordnung wird in der Tabelle `user_locations` gespeichert
3. Bei jedem API-Request lädt die Auth-Middleware `location_ids[]` für den eingeloggten User
4. Endpunkte mit Standortfilterung geben nur Daten der erlaubten Standorte zurück

### Filterung aktiv bei

- `GET /visitors` — Besucherliste
- `GET /visitors/active` — Aktive Besucher
- `GET /visitors?status=completed` — Ausgecheckte Besucher
- `GET /reports/evacuation` — Evakuierungsliste

### Regeln

| Situation | Verhalten |
|---|---|
| superadmin / admin | Immer alle Standorte — keine Filterung |
| Receptionist mit 0 Standorten | Alle Standorte sichtbar (kein Filter) |
| Receptionist mit 1+ Standorten | Nur zugewiesene Standorte |

### Benutzeroberfläche

In der Benutzertabelle (Einstellungen) gibt es eine Spalte "Standorte":
- Blau markierte Standort-Badges = eingeschränkter Zugriff
- "Alle" = kein Filter

---

## 13. Badge-Drucker (Brother QL-820NWB)

### Hardware

| Eigenschaft | Wert |
|---|---|
| Modell | Brother QL-820NWB |
| Verbindung | Netzwerk (IP-Adresse, RAW TCP) |
| Port | 9100 (konfigurierbar im Admin) |
| Etikett | DK-11202 (62 × 100 mm) |
| Auflösung | 300 dpi → 696 × 1109 Pixel |

### Konfiguration

**Einstellungen → Etikettendrucker:**
- Drucker aktivieren (Checkbox)
- IP-Adresse eingeben
- Port (Standard: 9100)
- "Verbindung testen" Button

Einstellungen werden in `system_settings` gespeichert (kein Neustart nötig).

### Technische Umsetzung

**`backend/src/services/label-printer.js`:**
- Canvas (696 × 1109 px) mit abat-Branding rendern
- Brother QL Raster Protocol: Init → Raster-Modus → Print-Info (DK-11202) → Zeilendaten → Drucken
- Jede Zeile: 87 Bytes (696 / 8 = 87), MSB-first Bit-Reihenfolge
- TCP-Verbindung via `net.Socket` mit 8 s Timeout

### Label-Inhalt

- abat-Logo oben links
- Besuchername (groß)
- Unternehmen
- Gastgeber
- Badge-Nummer
- Parkplatz (falls vorhanden)
- Datum & Uhrzeit

### Badge per Knopfdruck

In der Besucherliste gibt es pro Zeile einen **Drucker-Button** (lila). Er ruft `POST /api/visitors/:id/print-badge/:visitId` auf. Der Button pulsiert während des Druckens.

### PDF-Badge (A6 Landscape)

Zusätzlich zum Etikettendruck gibt es weiterhin den PDF-Badge-Download:
- Format: A6 Landscape (~419 × 298 pt)
- Blauer Akzentstreifen links (8 px, `#00A3E0`)
- Blauer Header-Bereich (`#004B87`) mit Titel + Datum
- QR-Code oben rechts (84 × 84 pt)
- Besuchername groß, Firma, Info-Grid mit Gastgeber + Badge-Nr. + Parkplatz
- Grauer Footer mit Hinweis

---

## 14. E-Mail-System

### Ausgehende E-Mails

| Auslöser | Empfänger | Beschreibung |
|---|---|---|
| Vorregistrierung erstellt (mit E-Mail) | Besucher | QR-Code (CID-Anhang), abat-ID, Besuchsdetails, Google Maps Link |
| Check-in (Kiosk oder Admin) | Gastgeber | Benachrichtigung: Besucher ist eingetroffen, Badge-Nr., abat-ID |
| Check-in (wenn `visitor_email_confirmation = true`) | Besucher | Bestätigung mit Datum, Zeit, Gastgeber, Badge-Nr., Parkplatz |

### E-Mail-Design (alle drei Mails)

Alle E-Mails verwenden eine gemeinsame `emailShell(content, company)`-Funktion (`email.js`) mit einheitlichem Layout:

```
┌─────────────────────────────────────┐
│  abat AG            (blau #004B87)  │  ← Header
│  abat AG · Besuchsverwaltung        │
├─────────────────────────────────────┤
│  Guten Tag, [Name]!                 │  ← Personalisierte Begrüßung
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Besuchsdetails               │  │  ← Detail-Karte (grau)
│  │ Datum    15. Juni 2026       │  │
│  │ Gastgeber  Max Mustermann    │  │
│  │ Standort   Bremen            │  │
│  │            📍 Google Maps →  │  │
│  └───────────────────────────────┘  │
│                                     │
│        [ QR-Code 210×210 ]          │  ← QR eingebettet (CID)
│                                     │
│  ┌─ abat-ID (Fallback) ───────────┐ │  ← Blauer linker Rand
│  │  ABAT-12345678                 │ │
│  └────────────────────────────────┘ │
│                                     │
│  Mit freundlichen Grüßen,           │
│  abat AG                            │
├─────────────────────────────────────┤
│  Automatisch generiert ...  (grau)  │  ← Footer
└─────────────────────────────────────┘
```

**Responsive Design:**
- Äußeres Layout: `max-width: 560px`, auf Mobilgeräten `100%` Breite
- Innen-Padding: 36px Desktop, 28px Mobil (via `@media` in `<style>`)
- QR-Code: 210×210px Desktop → 180×180px Mobil
- Detail-Zeilen: zweispaltig Desktop → einspaltiger Stack Mobil
- Keine externen Ressourcen (Bilder, Fonts) — nur CID für QR-Code

**Technisch:**
- Volle HTML-Dokumente (`<!DOCTYPE html>`) mit `<meta charset>`, `<meta viewport>`, `<style>` für Media Queries
- Vollständig inline gestylte kritische Elemente für maximale E-Mail-Client-Kompatibilität (Gmail, Outlook, Apple Mail, Thunderbird)
- QR-Code als CID-Anhang (`cid:qrcode@abat`) in `nodemailer` `attachments[]`

### QR-Code in E-Mail

| Eigenschaft | Wert |
|---|---|
| Generierung | Serverseitig via `qrcode` npm-Paket |
| Format | PNG-Buffer (`generateQR()`) |
| Übertragung | CID-Inline-Anhang (`cid:qrcode@abat`) — funktioniert in allen E-Mail-Clients |
| Inhalt | Roher QR-Code-String (z.B. `PRE-1718459234567-ABCDEF`) |
| Größe | 200×200 px (Generierung), 210×210 px (Darstellung in E-Mail) |

> `data:` URLs (Base64 direkt im `<img src>`) werden von den meisten E-Mail-Clients blockiert. CID-Anhänge umgehen das vollständig.

### SMTP-Konfiguration

SMTP-Zugangsdaten werden in der `.env`-Datei gespeichert und sind **nur durch Datei-Bearbeitung + Neustart** änderbar. Die Verschlüsselung (`smtp_security`) wird zusätzlich in `system_settings` gespeichert und ist **ohne Neustart** änderbar.

Unter **Einstellungen → E-Mail** werden alle aktuell gespeicherten Werte schreibgeschützt angezeigt:

| Feld | Quelle | Besonderheit |
|---|---|---|
| SMTP-Host | `SMTP_HOST` aus `.env` | |
| SMTP-Port | Abgeleitet vom aktiven Verschlüsselungstyp | Aktualisiert sich beim Umschalten der Verschlüsselung |
| SMTP-Benutzer | `SMTP_USER` aus `.env` | |
| SMTP-Passwort | `SMTP_PASS` aus `.env` | Immer maskiert (`••••••••`) |
| Absender-E-Mail | `FROM_EMAIL` aus `.env` | |
| Firmenname | `COMPANY_NAME` aus `.env` | |

Der Port wird nicht aus der `.env` gelesen, sondern direkt aus dem aktiven Verschlüsselungstyp berechnet (`system_settings`). Daher stimmt er immer mit der Auswahl überein.

API-Endpoint: `GET /api/settings/smtp-config` (admin+) — gibt `.env`-Werte zurück, Passwort wird serverseitig maskiert.

### Verschlüsselungsoptionen

| Option | Port | Technik | Verwendung |
|---|---|---|---|
| **STARTTLS** | 587 | `secure: false` | Standard — Gmail, Office 365 |
| **SSL / TLS** | 465 | `secure: true` | Ältere Server / manche Hoster |
| **Keine** | 25 | `secure: false, ignoreTLS: true` | Interne Mailserver ohne Zertifikat |

### Test-E-Mail

Unter **Einstellungen → E-Mail → Test-E-Mail senden**:
1. Empfänger-E-Mail eingeben
2. "Test senden" klicken
3. Backend prüft SMTP-Verbindung (`transport.verify()`) und sendet Test-E-Mail
4. Erfolg/Fehler als Toast-Meldung

Bei Fehler wird die konkrete SMTP-Fehlermeldung angezeigt.

### Fallback ohne SMTP

Wenn kein SMTP konfiguriert ist (`SMTP_USER` nicht gesetzt oder Platzhalterwert `your@email.com`), werden E-Mails nur in der Konsole geloggt — kein Absturz.

---

## 15. GDPR & Datenschutz

### Datenschutzerklärung-Unterschrift am Kiosk

Konfigurierbar unter **Einstellungen → Datenschutz**:

| Einstellung | Beschreibung |
|---|---|
| `privacy_policy_enabled` | Unterschrift am Kiosk erforderlich (Checkbox) |
| `privacy_policy_text` | Freitextfeld — vollständiger Datenschutztext (mehrzeilig) |

**Ablauf am Kiosk:**
1. Nach Daten-Bestätigung (Stufe "confirm") öffnet sich Stufe "privacy"
2. Text wird in scrollbarem Block angezeigt
3. Besucher unterschreibt mit Finger/Stift auf dem Touchscreen
4. Erst nach Unterschrift wird der Check-in-Button aktiv
5. Unterschrift → Base64-PNG → Server → Datei in `/uploads/signatures/privacy-*.png`

Ist `privacy_policy_enabled = false`, wird die Stufe komplett übersprungen.

### Automatische Anonymisierung

Konfigurierbar unter **Einstellungen → Datenschutz**.

| Einstellung | Beschreibung |
|---|---|
| Aufbewahrungsdauer | Anzahl Tage bis zur Anonymisierung (Standard: 365) |
| E-Mail-Bestätigung | Check-in-Bestätigung an Besucher ein/aus |

**Bereinigung ausführen:** Button "Jetzt bereinigen" → zeigt Anzahl anonymisierter Datensätze.

### Was wird anonymisiert

Besucher, deren letzter Check-in älter als N Tage ist und die **keinen aktiven Visit** haben:

```
first_name  → '[GELÖSCHT]'
last_name   → '[GELÖSCHT]'
email       → NULL
phone       → NULL
company     → NULL
photo_path  → NULL
```

Visit-Statistiken (Datum, Uhrzeit, Standort, Badge-Nr.) bleiben erhalten.

---

## 16. Infrastruktur & Deployment

### Systemd-Service

**Service-Datei:** `/etc/systemd/system/visitor-mgmt.service`

```ini
[Unit]
Description=Visitor Management System Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/visitor-mgmt/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/visitor-mgmt/backend/.env

[Install]
WantedBy=multi-user.target
```

### Nginx

- HTTP (80) → HTTPS-Redirect
- HTTPS (443) mit Cloudflare Origin Certificate
- `/api/*` → Proxy zu `http://127.0.0.1:3001`
- `/` → React SPA aus `/opt/visitor-mgmt/frontend/dist`
- Gzip-Komprimierung, 1 Jahr Cache für statische Assets

---

## 17. SSL & Cloudflare

| Eigenschaft | Wert |
|---|---|
| Typ | Cloudflare Origin Certificate |
| Gültig bis | 11. Juni 2041 |
| Zertifikat | `/etc/ssl/visitor-mgmt/cert.pem` |
| Private Key | `/etc/ssl/visitor-mgmt/key.pem` |

Cloudflare muss auf **Full (Strict)** SSL gestellt sein.

---

## 18. Umgebungsvariablen (.env)

**Datei:** `/opt/visitor-mgmt/backend/.env`

```env
PORT=3001
JWT_SECRET=REDACTED
DB_PATH=./data/visitors.db

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
SMTP_SECURITY=starttls
FROM_EMAIL=noreply@abat.de
COMPANY_NAME=abat AG
```

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `PORT` | Ja | Backend-Port (3001) |
| `JWT_SECRET` | **Ja** | Zufälliger langer String |
| `DB_PATH` | Ja | SQLite-Datenbankpfad |
| `SMTP_HOST` | Nein | SMTP-Server |
| `SMTP_PORT` | Nein | SMTP-Port |
| `SMTP_USER` | Nein | SMTP-Benutzername |
| `SMTP_PASS` | Nein | SMTP-Passwort / App-Passwort |
| `SMTP_SECURITY` | Nein | `starttls` / `ssl` / `none` (Fallback, DB hat Vorrang) |
| `FROM_EMAIL` | Nein | Absender-Adresse |
| `COMPANY_NAME` | Nein | Firmenname (in Mails und Badge) |

> `SMTP_SECURITY` aus der `.env` ist der Fallback — der Wert in `system_settings` hat immer Vorrang und ist ohne Neustart änderbar.

---

## 19. Wichtige Befehle

### Service-Verwaltung

```bash
systemctl status visitor-mgmt
systemctl restart visitor-mgmt      # nach .env-Änderungen
systemctl reload nginx
journalctl -u visitor-mgmt -f       # Live-Logs
journalctl -u visitor-mgmt -n 100
```

### Frontend neu bauen

```bash
cd /opt/visitor-mgmt/frontend
npm run build
# Kein Nginx-Reload nötig
```

### Datenbank-Backup

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  ".backup /root/backup-$(date +%Y%m%d).db"
```

### API testen

```bash
# Health Check
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@abat.de","password":"REDACTED"}'

# Systemeinstellungen (mit Token)
TOKEN="<JWT-Token>"
curl http://localhost:3001/api/settings/system \
  -H "Authorization: Bearer $TOKEN"
```

---

## 20. Fehlerbehebung

### Backend startet nicht

```bash
journalctl -u visitor-mgmt -n 50
cd /opt/visitor-mgmt/backend && node src/index.js  # detaillierter Fehler
```

Häufige Ursachen: `.env` fehlt, Port 3001 belegt (`ss -tlnp | grep 3001`), fehlende Pakete (`npm install`).

### Etikettendrucker antwortet nicht

1. Drucker im Netzwerk erreichbar: `ping <Drucker-IP>`
2. Port 9100 erreichbar: `nc -zv <Drucker-IP> 9100`
3. "Verbindung testen" in Einstellungen → Etikettendrucker
4. Drucker-IP und Port im Admin prüfen

### E-Mail wird nicht gesendet

1. SMTP-Test unter **Einstellungen → E-Mail → Test-E-Mail senden**
2. Fehlermeldung gibt konkreten SMTP-Fehler aus
3. `.env` prüfen: `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`
4. Verschlüsselung prüfen (STARTTLS ↔ SSL je nach Provider)
5. Bei Gmail: App-Passwort verwenden (kein normales Passwort)
6. Nach `.env`-Änderung: `systemctl restart visitor-mgmt`

### Benutzer sieht falsche Standortdaten

Standortzuweisungen in **Einstellungen → Benutzer** prüfen. Kein Eintrag = alle Standorte sichtbar.

### Login funktioniert nicht

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  "SELECT id, name, email, role, active FROM users;"
```

### SSL-Fehler

Cloudflare SSL-Modus muss **Full (Strict)** sein.

### Frontend zeigt alte Version

Hard-Reload: `Ctrl+Shift+R`. JS/CSS-Dateien haben Content-Hash im Namen — Caching-Probleme treten normalerweise nicht auf.

---

## Dateipfade auf einen Blick

| Was | Pfad |
|---|---|
| Projekt-Root | `/opt/visitor-mgmt/` |
| Backend-App | `/opt/visitor-mgmt/backend/src/index.js` |
| Datenbank | `/opt/visitor-mgmt/backend/data/visitors.db` |
| Umgebungsvariablen | `/opt/visitor-mgmt/backend/.env` |
| Uploads | `/opt/visitor-mgmt/backend/uploads/` |
| Frontend-Build | `/opt/visitor-mgmt/frontend/dist/` |
| Nginx-Konfiguration | `/etc/nginx/sites-available/visitor.luwilab.work` |
| SSL-Zertifikat | `/etc/ssl/visitor-mgmt/cert.pem` |
| Systemd-Service | `/etc/systemd/system/visitor-mgmt.service` |
| Zugangsdaten | `/root/visitor-mgmt-credentials.txt` |
| Diese Dokumentation | `/root/visitor-mgmt-dokumentation.md` |
