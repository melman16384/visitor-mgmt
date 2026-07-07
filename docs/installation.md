# Installationsanleitung — Besucherverwaltungssystem

> Zielumgebung: Ubuntu/Debian Server · Node.js 22+ · Nginx

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Projekt einrichten](#2-projekt-einrichten)
3. [Backend konfigurieren](#3-backend-konfigurieren)
4. [Frontend bauen](#4-frontend-bauen)
5. [Nginx einrichten](#5-nginx-einrichten)
6. [SSL-Zertifikat einrichten](#6-ssl-zertifikat-einrichten)
7. [Backend mit pm2 starten](#7-backend-mit-pm2-starten)
8. [Erster Start & Test](#8-erster-start--test)
9. [Cloudflare konfigurieren](#9-cloudflare-konfigurieren)

---

## 1. Voraussetzungen

> **Netzwerk-Hinweis (Minimal-Prinzip):** Während der Installation werden `registry.npmjs.org:443`, `deb.nodesource.com:443` und `github.com:443` benötigt. Im laufenden Betrieb gibt es keine externen Abhängigkeiten — nur euer SMTP-Server und der Etikettendrucker im LAN. Details: [Netzwerk & Firewall-Freigaben](dokumentation.md#25-netzwerk--firewall-freigaben)

```bash
# Node.js 22 installieren
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Nginx installieren
apt install -y nginx

# Versionen prüfen
node -v    # v22.x oder höher
npm -v
nginx -v
```

---

## 2. Projekt einrichten

```bash
# Zielverzeichnis erstellen
mkdir -p /opt/visitor-mgmt
cd /opt/visitor-mgmt

# Repository klonen (privat — SSH-Key oder Token erforderlich)
git clone https://github.com/melman16384/visitor-mgmt.git .

# Backend-Abhängigkeiten installieren
cd /opt/visitor-mgmt/backend
npm install

# Frontend-Abhängigkeiten installieren
cd /opt/visitor-mgmt/frontend
npm install
```

---

## 3. Backend konfigurieren

```bash
cd /opt/visitor-mgmt/backend
cp .env.example .env
nano .env
```

`.env` ausfüllen:

```env
PORT=3001
JWT_SECRET=<langer-zufälliger-string>   # z.B. openssl rand -hex 64
DB_PATH=/opt/visitor-mgmt/backend/data/visitors.db   # absoluten Pfad verwenden (siehe Hinweis)

SMTP_HOST=smtp.gmail.com        # Fallback — kann auch im Admin-Panel gesetzt werden
SMTP_PORT=587
SMTP_SECURITY=starttls          # ssl, starttls oder none
SMTP_USER=deine@email.de
SMTP_PASS=dein-app-passwort
FROM_EMAIL=noreply@firma.de
COMPANY_NAME=Firmenname GmbH

# Öffentliche URL der App (für E-Mail-Links und CORS)
FRONTEND_URL=https://besucher.meinefirma.de
APP_URL=https://besucher.meinefirma.de

# Optionaler initialer Admin-Account (Standard: admin@example.com / ChangeMe123!)
# ADMIN_EMAIL=admin@meinefirma.de
# ADMIN_PASSWORD=SicheresPasswort123!
```

> **JWT_SECRET** niemals leer lassen und nicht in Git einchecken.
>
> **DB_PATH absolut setzen:** Bei einem relativen Pfad (`./data/visitors.db`) hängt die genutzte
> Datenbank vom Startverzeichnis des Prozesses ab. Wird das Backend versehentlich aus einem anderen
> Verzeichnis gestartet (z.B. durch pm2-cwd, ein Cron-Backup oder einen manuellen `node`-Aufruf aus
> dem Repo-Root), legt SQLite eine **zweite, leere** `visitors.db` an — die App wirkt dann „leer" oder
> Logins schlagen fehl. Ein absoluter Pfad verhindert das zuverlässig.

Datenbankverzeichnis anlegen:

```bash
mkdir -p /opt/visitor-mgmt/backend/data
mkdir -p /opt/visitor-mgmt/backend/uploads/documents
mkdir -p /opt/visitor-mgmt/backend/uploads/signatures
```

Datenbank initialisieren (wird beim ersten Start automatisch erstellt):

```bash
cd /opt/visitor-mgmt/backend
node src/index.js
# Strg+C nach "Server running on port 3001"
```

---

## 4. Frontend bauen

```bash
cd /opt/visitor-mgmt/frontend
npm run build
# Erzeugt /opt/visitor-mgmt/frontend/dist/
```

---

## 5. Nginx einrichten

Konfigurationsdatei erstellen:

```bash
nano /etc/nginx/sites-available/visitor-mgmt
```

Inhalt:

```nginx
server {
    listen 80;
    server_name deine-domain.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name deine-domain.de;

    ssl_certificate     /etc/ssl/visitor-mgmt/cert.pem;
    ssl_certificate_key /etc/ssl/visitor-mgmt/key.pem;

    # React SPA
    root /opt/visitor-mgmt/frontend/dist;
    index index.html;

    # index.html nie cachen (Browser lädt sonst altes JS nach Updates)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        expires 0;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 25M;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
    }

    # Caching für statische Assets (Vite-gehashte Dateinamen → sicher für 1y)
    location ~* \.(js|css|png|jpg|svg|ttf|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
}
```

Aktivieren:

```bash
ln -s /etc/nginx/sites-available/visitor-mgmt /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 6. SSL-Zertifikat einrichten

### Option A — Cloudflare Origin Certificate (empfohlen)

1. Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
2. Zertifikat und Key kopieren:

```bash
mkdir -p /etc/ssl/visitor-mgmt
nano /etc/ssl/visitor-mgmt/cert.pem   # Zertifikat einfügen
nano /etc/ssl/visitor-mgmt/key.pem    # Private Key einfügen
chmod 600 /etc/ssl/visitor-mgmt/key.pem
```

3. Cloudflare SSL-Modus: **Full (Strict)**

### Option B — Let's Encrypt (ohne Cloudflare Proxy)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d deine-domain.de
```

---

## 7. Backend mit pm2 starten

Das Produktivsystem verwaltet das Backend mit **pm2** (Prozessname `visitor-mgmt`).

> **Sicherheit — kein root-Prozess:** Im Rahmen der Sicherheits-Härtung läuft der Prozess **nicht mehr
> als root**. Ein dedizierter, unprivilegierter Systembenutzer `svc-visitormgmt` wurde angelegt,
> `/opt/visitor-mgmt` gehört diesem Benutzer, und in `/opt/ecosystem.config.js` sind `uid` und `gid`
> auf `svc-visitormgmt` gesetzt. Zusätzlich bindet das Backend (`backend/src/index.js`) nur noch an
> `127.0.0.1` statt an `0.0.0.0` — von außen ist Port 3001 ohnehin nur über den Nginx-Reverse-Proxy und
> nicht direkt aus dem Internet erreichbar (siehe [Sicherheit → Netzwerk & Firewall](dokumentation.md#18-sicherheit)).

```bash
# pm2 global installieren (falls noch nicht vorhanden)
npm install -g pm2

cd /opt/visitor-mgmt/backend
pm2 start src/index.js --name visitor-mgmt --cwd /opt/visitor-mgmt/backend
pm2 save                  # Prozessliste persistieren
pm2 startup               # einmalig: pm2 nach Reboot automatisch starten (Anweisung ausführen)
```

> Produktiv wird der Prozess über `/opt/ecosystem.config.js` mit `uid`/`gid: 'svc-visitormgmt'`
> gestartet (`pm2 start /opt/ecosystem.config.js`), nicht direkt als root per obigem Befehl.

Alltagsbefehle:

```bash
pm2 restart visitor-mgmt  # nach jedem git pull
pm2 logs visitor-mgmt     # Live-Logs
pm2 list                  # Status aller Prozesse
```

> **Wichtig:** Nach `git pull` immer `pm2 restart visitor-mgmt`. Läuft der Prozess nicht, antwortet
> Nginx auf `/api` nicht und das Frontend meldet generisch „Anmeldung fehlgeschlagen" — das ist dann
> **kein** Passwortproblem, sondern ein nicht laufendes Backend.
>
> **SMTP-Einstellungen** müssen **nicht** per Neustart übernommen werden — sie lassen sich direkt im
> Admin-Panel unter **Einstellungen → E-Mail** (nur Superadmin) ändern und wirken sofort. Die `.env`
> dient nur als initialer Fallback.

---

## 8. Erster Start & Test

```bash
# Backend-Status prüfen
pm2 list

# Live-Logs ansehen
pm2 logs visitor-mgmt

# API direkt testen
curl http://localhost:3001/api/health

# Login testen
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@abat.de","password":"<passwort>"}'
```

Standard-Login nach erstem Start:

| E-Mail | Passwort | Rolle |
|---|---|---|
| `admin@example.com` | `ChangeMe123!` | superadmin |

Eigene Zugangsdaten beim ersten Start setzen: `ADMIN_EMAIL` und `ADMIN_PASSWORD` in der `.env` eintragen **bevor** das Backend das erste Mal gestartet wird.

> Passwort sofort nach dem ersten Login unter **Einstellungen → Passwort ändern** ändern.

---

## 8a. Zugangsdaten zurücksetzen

Falls der Login nicht funktioniert oder Passwörter vergessen wurden, können sie direkt per SQLite zurückgesetzt werden — kein Serverneustart nötig.

### Vorhandene Benutzer anzeigen

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  "SELECT id, name, email, role, active FROM users;"
```

### Passwort eines einzelnen Accounts zurücksetzen

```bash
cd /opt/visitor-mgmt/backend

# Passwort und E-Mail anpassen:
NEUES_PW="DeinNeuesPasswort123!"
EMAIL="admin@example.com"   # E-Mail des Accounts anpassen

HASH=$(node -e "const b=require('./node_modules/bcryptjs'); b.hash('$NEUES_PW',12).then(h=>process.stdout.write(h))")
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db "UPDATE users SET password_hash='$HASH' WHERE email='$EMAIL';"
```

> Den **absoluten** DB-Pfad verwenden (muss mit `DB_PATH` aus der `.env` übereinstimmen), sonst wird
> evtl. eine andere/leere DB bearbeitet als die, die das laufende Backend nutzt.

### Passwort aller Accounts auf einmal zurücksetzen

```bash
cd /opt/visitor-mgmt/backend

NEUES_PW="DeinNeuesPasswort123!"
HASH=$(node -e "const b=require('./node_modules/bcryptjs'); b.hash('$NEUES_PW',12).then(h=>process.stdout.write(h))")
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db "UPDATE users SET password_hash='$HASH';"
```

Danach mit der jeweiligen E-Mail-Adresse und dem neuen Passwort einloggen. Passwort anschließend unter **Einstellungen → Passwort ändern** personalisieren.

---

## 9. Cloudflare konfigurieren

1. DNS-Eintrag: `A deine-domain.de → Server-IP` (Proxy aktiviert = orange Wolke)
2. SSL/TLS-Modus: **Full (Strict)**
3. Empfohlen: Automatic HTTPS Rewrites aktivieren

---

## Updates einspielen

```bash
cd /opt/visitor-mgmt
git pull

# Backend (falls package.json geändert)
cd backend && npm install

# Frontend neu bauen
cd /opt/visitor-mgmt/frontend
npm run build

# Backend neu starten
pm2 restart visitor-mgmt
```

> Nach jedem Update unbedingt `pm2 restart visitor-mgmt` — ohne Neustart läuft weiter der alte Code.

---

## Datenbank-Backup

Manuelles Ad-hoc-Backup:

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  ".backup /root/backup-$(date +%Y%m%d).db"
```

### Automatisches tägliches Backup (bereits eingerichtet)

Im Rahmen der Sicherheits-Härtung wurde ein Cron-Eintrag unter `/etc/cron.d/visitor-mgmt-backups`
angelegt, der `backup.sh` täglich um **02:00 Uhr** als Benutzer `svc-visitormgmt` ausführt und nach
`logs/backup.log` protokolliert — das ist kein optionaler manueller Schritt mehr, sondern auf dem
Produktivserver bereits aktiv.

Prüfen/anpassen:

```bash
# Cron-Job anzeigen
cat /etc/cron.d/visitor-mgmt-backups

# Backup-Log prüfen
tail -n 50 /opt/visitor-mgmt/logs/backup.log

# Vorhandene Backups auflisten
ls -la /opt/visitor-mgmt/backups/
```

> Bei einer Neuinstallation auf einem anderen Server muss dieser Cron-Job manuell angelegt werden —
> `backup.sh` selbst existiert im Repository, wird aber ohne Cron-Eintrag nie automatisch ausgeführt.
