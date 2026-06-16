#!/bin/bash
BACKUP_DIR="/opt/visitor-mgmt/backups"
DB_PATH="/opt/visitor-mgmt/backend/data/visitors.db"
KEEP_DAYS=30
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_PATH" ".backup ${BACKUP_DIR}/visitors-${DATE}.db"

if [ $? -eq 0 ]; then
  echo "[backup] visitors-${DATE}.db erstellt"
else
  echo "[backup] FEHLER beim Backup" >&2
  exit 1
fi

find "$BACKUP_DIR" -name "visitors-*.db" -mtime +${KEEP_DAYS} -delete
echo "[backup] Alte Backups (>${KEEP_DAYS} Tage) bereinigt"
