# Besucherverwaltungssystem — abat AG

Vollständiges, webbasiertes Besucherverwaltungssystem für Unternehmen mit React-Frontend, Node.js/Express-Backend und SQLite-Datenbank.

## Dokumentation

| Dokument | Beschreibung |
|---|---|
| [Manuelle Installation](docs/installation.md) | Setup direkt auf Ubuntu/Debian mit Nginx & pm2 |
| [Projektdokumentation](docs/dokumentation.md) | Vollständige technische Dokumentation: Architektur, API, DB-Schema, Features |

## Tech Stack

| Bereich | Technologien |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Mulish Font |
| **Backend** | Node.js (≥ 20), Express.js 5, better-sqlite3 12, JWT (+ TOTP-2FA, verpflichtend für Admin-Konten), ldapts (AD-Sync) |
| **Sicherheit** | helmet, express-rate-limit, bcryptjs (cost 12) |
| **Services** | PDFKit (Badge), Nodemailer (E-Mail), html5-qrcode (Scanner) |
| **Infra** | Nginx, pm2, Cloudflare, SQLite (WAL-Modus) |

## Features

- Check-in / Check-out per QR-Code, abat-ID oder manuell
- Kiosk-Modus (Deutsch / Englisch) für Tablets am Empfang
- Vorregistrierungen mit QR-Code-Versand per E-Mail (Einzel- & Gruppenregistrierung)
- **Host-Portal** — Gastgeber können sich einloggen, Besucher einsehen und Vorregistrierungen selbst erstellen
- **Zwei-Faktor-Authentifizierung (TOTP)** — verpflichtend für Admin-Konten, mit Backup-Codes und Account-Lockout nach 5 Fehlversuchen
- **Gastgeber-Synchronisierung (AD-Sync)** — Gastgeber automatisch aus Active Directory/LDAP übernehmen, täglich oder manuell
- **Auto-Checkout** täglich um 19:00 Uhr (Uhrzeit konfigurierbar in den Admin-Einstellungen)
- **Audit-Log** — 90 Tage Aufbewahrung, Download als Tagesprotokoll-Datei, Compliance-Bericht als CSV
- Badge-Druck als PDF (A6)
- Evakuierungsliste in Echtzeit, nach Standort gruppiert
- Standortbasierte Zugriffskontrolle für Empfangs-Benutzer
- GDPR-konforme automatische Datenanonymisierung
- Datenschutzerklärung-Unterschrift am Kiosk (Canvas)
- E-Mail-Benachrichtigungen (STARTTLS / SSL / Keine)

## Schnellstart (Entwicklung)

```bash
# Backend
cd backend
cp .env.example .env   # .env ausfüllen
npm install
npm start              # http://localhost:3001

# Frontend (separates Terminal)
cd frontend
npm install
npm run dev            # http://localhost:3000  (Proxy /api → :3001)
```

Vollständige Installationsanleitung: [docs/installation.md](docs/installation.md)

## Routen

| Route | Beschreibung | Auth |
|---|---|---|
| `/login` | Admin-Anmeldung | Nein |
| `/dashboard` | Übersicht mit Statistiken | Ja |
| `/visitors` | Besucherliste und Eincheck-Funktion | Ja |
| `/hosts` | Gastgeberverwaltung | Ja |
| `/preregistrations` | Vorregistrierungen mit QR-Code | Ja |
| `/evacuation` | Evakuierungsliste (Echtzeit) | Ja |
| `/reports` | Berichte; CSV-Export nur Admin | Ja |
| `/settings` | Konfiguration, Benutzer, E-Mail, AD-Sync | Ja (admin) |
| `/audit-log` | Audit-Log & Compliance-Bericht | Ja (admin) |
| `/2fa-setup` | Erzwungene 2FA-Einrichtung für Admins | Ja |
| `/kiosk` | Selbst-Eincheck-Kiosk | Nein |
| `/host/login` | Gastgeber-Portal Anmeldung | Nein |
| `/host` | Gastgeber-Portal | Host-Token |

Rollen: `admin` (voller Zugriff, 2FA verpflichtend) / `receptionist` (standortgefiltert) / `host` (nur eigenes Portal). Die frühere Rolle `superadmin` wurde entfernt — siehe [docs/dokumentation.md](docs/dokumentation.md#12-zugangsdaten--benutzerrollen).
