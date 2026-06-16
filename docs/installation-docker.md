# Docker-Installationsanleitung — Besucherverwaltungssystem

> Empfohlene Methode für Produktiv-Deployments. Kein Node.js oder Nginx auf dem Host erforderlich.

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Projekt einrichten](#2-projekt-einrichten)
3. [Umgebungsvariablen konfigurieren](#3-umgebungsvariablen-konfigurieren)
4. [Starten](#4-starten)
5. [SSL & Domain einrichten](#5-ssl--domain-einrichten)
6. [Nützliche Befehle](#6-nützliche-befehle)
7. [Updates einspielen](#7-updates-einspielen)
8. [Daten & Backups](#8-daten--backups)

---

## 1. Voraussetzungen

```bash
# Docker installieren
curl -fsSL https://get.docker.com | bash

# Docker Compose Plugin prüfen (in Docker 20.10+ enthalten)
docker compose version

# Versionen prüfen
docker -v        # Docker 20.10+
docker compose version  # v2.x
```

---

## 2. Projekt einrichten

```bash
# Repository klonen
git clone https://github.com/melman16384/visitor-mgmt.git
cd visitor-mgmt

# .env aus Vorlage erstellen
cp .env.example .env
```

---

## 3. Umgebungsvariablen konfigurieren

```bash
nano .env
```

`.env` ausfüllen:

```env
# Pflichtfelder
JWT_SECRET=<langer-zufälliger-string>    # openssl rand -hex 32
APP_URL=https://deine-domain.de          # Öffentliche URL — KEIN abschließender Slash!

# Initialer Admin-Account (nur beim ersten Start, solange DB leer ist)
ADMIN_EMAIL=admin@firma.de
ADMIN_PASSWORD=<sicheres-passwort>
ADMIN_NAME=Administrator

# Optionaler HTTP-Port des Frontends (Standard: 80)
HTTP_PORT=80

# E-Mail (optional — ohne SMTP werden Mails nur geloggt)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<smtp-benutzer>
SMTP_PASS=<smtp-passwort>
FROM_EMAIL=<absender@firma.de>
COMPANY_NAME=<Firmenname>
```

> **JWT_SECRET** generieren: `openssl rand -hex 32`
>
> **APP_URL ist Pflicht für Produktion.** Das Backend prüft den `Origin`-Header aller Browser-Requests gegen diese URL. Stimmt die URL nicht überein, blockiert CORS alle API-Aufrufe und die App zeigt nur leere Seiten.

---

## 4. Starten

```bash
# Images bauen und Container starten
docker compose up -d --build

# Logs prüfen
docker compose logs -f
```

Die App ist danach erreichbar unter: **http://Server-IP**

### Architektur im Container

```
Browser
   │  HTTP :80
   ▼
frontend-Container (Nginx)
   ├── /          → React SPA (statische Dateien)
   ├── /api/      → Proxy → backend:3001
   └── /uploads/  → Proxy → backend:3001

backend-Container (Node.js :3001)
   └── SQLite → Docker Volume "db_data"
```

Frontend und Backend kommunizieren über das interne Docker-Netzwerk (`backend` als Hostname). Nginx im Frontend-Container übernimmt das Routing — kein separater Reverse-Proxy auf dem Host nötig.

---

## 5. SSL & Domain einrichten

Der Container lauscht auf HTTP (Port 80). Für HTTPS gibt es zwei Optionen:

### Option A — Cloudflare (empfohlen, einfachste Methode)

1. Domain in Cloudflare hinzufügen
2. DNS-Eintrag: `A deine-domain.de → Server-IP` (Proxy = orange Wolke aktiv)
3. Cloudflare SSL-Modus: **Flexible** (Cloudflare ↔ Browser = HTTPS, Cloudflare ↔ Server = HTTP)
4. Fertig — keine Zertifikate auf dem Server nötig

Für **Full (Strict)** zusätzlich einen Nginx-Reverse-Proxy mit Origin Certificate auf dem Host einrichten (siehe [Installationsanleitung ohne Docker](installation.md#6-ssl-zertifikat-einrichten)).

### Option B — Nginx auf dem Host mit Let's Encrypt

Nginx als Reverse Proxy vor dem Container installieren:

```bash
apt install -y nginx certbot python3-certbot-nginx
certbot --nginx -d deine-domain.de
```

Nginx-Konfiguration (`/etc/nginx/sites-available/visitor-mgmt`):

```nginx
server {
    listen 80;
    server_name deine-domain.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name deine-domain.de;

    ssl_certificate     /etc/letsencrypt/live/deine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deine-domain.de/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 25M;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/visitor-mgmt /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 6. Nützliche Befehle

```bash
# Status aller Container
docker compose ps

# Live-Logs ansehen
docker compose logs -f

# Nur Backend-Logs
docker compose logs -f backend

# Container neu starten (z.B. nach .env-Änderung)
docker compose restart

# Alles stoppen
docker compose down

# Alles stoppen inkl. Volumes (ACHTUNG: löscht Datenbank!)
docker compose down -v

# In den Backend-Container einloggen
docker compose exec backend sh

# SQLite direkt abfragen
docker compose exec backend sqlite3 /app/data/visitors.db ".tables"
```

---

## 7. Updates einspielen

```bash
cd visitor-mgmt

# Neuen Code holen
git pull

# Images neu bauen und Container ersetzen (ohne Downtime bei den Volumes)
docker compose up -d --build

# Alte, ungenutzte Images aufräumen
docker image prune -f
```

---

## 8. Daten & Backups

Datenbank und Uploads werden in **Docker Volumes** gespeichert und überleben `docker compose down`.

| Volume | Inhalt |
|---|---|
| `db_data` | SQLite-Datenbank (`visitors.db`) |
| `uploads` | Besuchersignaturen & hochgeladene Dokumente |

### Datenbank sichern

```bash
# Backup in aktuelles Verzeichnis
docker compose exec backend sqlite3 /app/data/visitors.db \
  ".backup /app/data/backup-$(date +%Y%m%d).db"

# Backup auf den Host kopieren
docker cp $(docker compose ps -q backend):/app/data/backup-$(date +%Y%m%d).db ./
```

### Automatisches tägliches Backup per Cron (auf dem Host)

```bash
crontab -e
# Täglich um 03:00 Uhr
0 3 * * * cd /pfad/zu/visitor-mgmt && docker compose exec -T backend sqlite3 /app/data/visitors.db ".backup /app/data/backup-$(date +\%Y\%m\%d).db"
```
