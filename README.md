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
| **Backend** | Node.js (≥ 20), Express.js 5, better-sqlite3 12, JWT (+ optionales TOTP-2FA) |
| **Sicherheit** | helmet, express-rate-limit, bcryptjs (cost 12) |
| **Services** | PDFKit (Badge), Nodemailer (E-Mail), html5-qrcode (Scanner) |
| **Infra** | Nginx, pm2, Cloudflare, SQLite (WAL-Modus) |

## Features

- Check-in / Check-out per QR-Code, abat-ID oder manuell
- Kiosk-Modus (Deutsch / Englisch) für Tablets am Empfang
- Vorregistrierungen mit QR-Code-Versand per E-Mail (Einzel- & Gruppenregistrierung)
- **Host-Portal** — Gastgeber können sich einloggen, Besucher einsehen und Vorregistrierungen selbst erstellen
- **Auto-Checkout** täglich um 19:00 Uhr (Uhrzeit konfigurierbar in Superadmin-Einstellungen)
- **Audit-Log** — 90 Tage Aufbewahrung, Download als Tagesprotokoll-Datei, Compliance-Bericht als CSV
- Badge-Druck als PDF (A6) und Etikettendrucker (Brother QL-820NWB)
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
| `/reports` | Berichte und CSV-Export | Ja (admin+) |
| `/settings` | Konfiguration, Benutzer, E-Mail | Ja (admin+) |
| `/audit-log` | Audit-Log & Compliance-Bericht | Ja (superadmin) |
| `/kiosk` | Selbst-Eincheck-Kiosk | Nein |
| `/host/login` | Gastgeber-Portal Anmeldung | Nein |
| `/host` | Gastgeber-Portal | Host-Token |
