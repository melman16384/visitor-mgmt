# Besucherverwaltungssystem — abat AG

Vollständiges, webbasiertes Besucherverwaltungssystem für Unternehmen mit React-Frontend, Node.js/Express-Backend und SQLite-Datenbank.

## Dokumentation

| Dokument | Beschreibung |
|---|---|
| [Installationsanleitung](docs/installation.md) | Schritt-für-Schritt-Setup auf einem Ubuntu/Debian-Server |
| [Projektdokumentation](docs/dokumentation.md) | Vollständige technische Dokumentation: Architektur, API, DB-Schema, Features |

## Tech Stack

| Bereich | Technologien |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Mulish Font |
| **Backend** | Node.js, Express.js, better-sqlite3, JWT |
| **Services** | PDFKit (Badge), Nodemailer (E-Mail), html5-qrcode (Scanner) |
| **Infra** | Nginx, systemd, Cloudflare, SQLite (WAL-Modus) |

## Features

- Check-in / Check-out per QR-Code, abat-ID oder manuell
- Kiosk-Modus (Deutsch / Englisch) für Tablets am Empfang
- Vorregistrierungen mit QR-Code-Versand per E-Mail
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
npm run dev            # http://localhost:5173
```

Vollständige Installationsanleitung für Produktionsumgebungen: [docs/installation.md](docs/installation.md)

## Routen

| Route | Beschreibung | Auth |
|---|---|---|
| `/login` | Anmeldung | Nein |
| `/dashboard` | Übersicht mit Statistiken | Ja |
| `/visitors` | Besucherliste und Eincheck-Funktion | Ja |
| `/hosts` | Gastgeberverwaltung | Ja |
| `/preregistrations` | Vorregistrierungen mit QR-Code | Ja |
| `/evacuation` | Evakuierungsliste (Echtzeit) | Ja |
| `/reports` | Berichte und CSV-Export | Ja (admin+) |
| `/settings` | Konfiguration, Benutzer, E-Mail | Ja (admin+) |
| `/kiosk` | Selbst-Eincheck-Kiosk | Nein |
