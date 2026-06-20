# Installationsanleitung — Besucherverwaltungssystem

> Zielumgebung: Ubuntu/Debian Server · Node.js 18+ · Nginx

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

> **Netzwerk-Hinweis (Minimal-Prinzip):** Während der Installation werden `registry.npmjs.org:443`, `deb.nodesource.com:443` und `github.com:443` benötigt. Im laufenden Betrieb gibt es keine externen Abhängigkeiten — nur euer SMTP-Server, ggf. euer AD/LDAP-Server und der Etikettendrucker im LAN. Details: [Netzwerk & Firewall-Freigaben](dokumentation.md#25-netzwerk--firewall-freigaben)

```bash
# Node.js 18+ installieren
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Nginx installieren
apt install -y nginx

# Versionen prüfen
node -v    # v18.x oder höher
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
JWT_SECRET=<langer-zufälliger-string>   # z.B. openssl rand -hex 32
DB_PATH=/opt/visitor-mgmt/backend/data/visitors.db   # absoluten Pfad verwenden (siehe Hinweis)

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine@email.de
SMTP_PASS=dein-app-passwort
FROM_EMAIL=noreply@firma.de
COMPANY_NAME=Firmenname
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

    # Caching für statische Assets
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

```bash
# pm2 global installieren (falls noch nicht vorhanden)
npm install -g pm2

cd /opt/visitor-mgmt/backend
pm2 start src/index.js --name visitor-mgmt --cwd /opt/visitor-mgmt/backend
pm2 save                  # Prozessliste persistieren
pm2 startup               # einmalig: pm2 nach Reboot automatisch starten (Anweisung ausführen)
```

Alltagsbefehle:

```bash
pm2 restart visitor-mgmt  # nach jedem git pull oder jeder .env-Änderung
pm2 logs visitor-mgmt     # Live-Logs
pm2 list                  # Status aller Prozesse
```

> **Wichtig:** Nach `git pull` und `.env`-Änderungen immer `pm2 restart visitor-mgmt`. Läuft der
> Prozess nicht, antwortet Nginx auf `/api` nicht und das Frontend meldet generisch
> „Anmeldung fehlgeschlagen" — das ist dann **kein** Passwortproblem, sondern ein nicht laufendes Backend.

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

Standard-Login nach erstem Start (aus `backend/src/db/database.js`):

| E-Mail | Passwort | Rolle |
|---|---|---|
| admin@firma.de | Admin123! | superadmin |
| empfang@firma.de | Empfang123! | receptionist |

> Passwörter sofort nach dem ersten Login unter **Einstellungen → Passwort ändern** ändern.

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
EMAIL="superadmin@abat.de"

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

```bash
sqlite3 /opt/visitor-mgmt/backend/data/visitors.db \
  ".backup /root/backup-$(date +%Y%m%d).db"
```

Tägliches automatisches Backup per Cron:

```bash
crontab -e
# Täglich um 03:00 Uhr
0 3 * * * sqlite3 /opt/visitor-mgmt/backend/data/visitors.db ".backup /root/backups/visitors-$(date +\%Y\%m\%d).db"
```
