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
7. [Systemd-Service einrichten](#7-systemd-service-einrichten)
8. [Erster Start & Test](#8-erster-start--test)
9. [Cloudflare konfigurieren](#9-cloudflare-konfigurieren)

---

## 1. Voraussetzungen

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
DB_PATH=./data/visitors.db

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine@email.de
SMTP_PASS=dein-app-passwort
FROM_EMAIL=noreply@firma.de
COMPANY_NAME=Firmenname
```

> **JWT_SECRET** niemals leer lassen und nicht in Git einchecken.

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

## 7. Systemd-Service einrichten

```bash
nano /etc/systemd/system/visitor-mgmt.service
```

Inhalt:

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

Service aktivieren:

```bash
systemctl daemon-reload
systemctl enable visitor-mgmt
systemctl start visitor-mgmt
systemctl status visitor-mgmt
```

---

## 8. Erster Start & Test

```bash
# Backend-Status prüfen
systemctl status visitor-mgmt

# Live-Logs ansehen
journalctl -u visitor-mgmt -f

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
systemctl restart visitor-mgmt
```

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
