const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { listAvailableDates, readDay, logFilePath } = require('../services/audit-log');

const router = express.Router();
const adminOnly = [authenticate, requireRole(['admin'])];

// GET /available-dates — list of dates with existing log files
router.get('/available-dates', ...adminOnly, (req, res) => {
  res.json(listAvailableDates());
});

// GET /download?date=YYYY-MM-DD — download raw .log file
router.get('/download', ...adminOnly, (req, res) => {
  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Ungültiges Datum' });
  }
  const filePath = logFilePath(date);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Keine Protokolldatei für dieses Datum' });
  }
  res.download(filePath, `audit-${date}.log`);
});

// GET /compliance-report?from=YYYY-MM-DD&to=YYYY-MM-DD — CSV download
router.get('/compliance-report', ...adminOnly, (req, res) => {
  const { from, to } = req.query;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'Ungültige Datumsangaben (YYYY-MM-DD erforderlich)' });
  }
  if (from > to) return res.status(400).json({ error: 'Von-Datum muss vor Bis-Datum liegen' });

  // --- Visitor records ---
  const visits = db.prepare(`
    SELECT
      vi.first_name, vi.last_name, vi.company, vi.email, vi.abat_id,
      h.name as host_name,
      l.name as location_name,
      v.purpose, v.status,
      v.checked_in_at, v.checked_out_at, v.notes
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    WHERE date(v.checked_in_at) BETWEEN ? AND ?
    ORDER BY v.checked_in_at ASC
  `).all(from, to);

  // --- Audit log entries ---
  const auditEntries = [];
  let cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];
    readDay(dateStr).forEach(e => auditEntries.push(e));
    cur.setDate(cur.getDate() + 1);
  }

  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const fmtDt = ts => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const p = n => String(n).padStart(2, '0');
      return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch { return ts; }
  };

  const lines = [];
  lines.push(`Compliance-Bericht abat AG Besucherverwaltung`);
  lines.push(`Berichtszeitraum: ${from} bis ${to}`);
  lines.push(`Erstellt am: ${new Date().toLocaleString('de-DE')}`);
  lines.push('');

  // Section 1: Besuchsprotokoll
  lines.push('=== BESUCHSPROTOKOLL ===');
  lines.push([
    'abat-ID', 'Vorname', 'Nachname', 'Unternehmen', 'E-Mail',
    'Gastgeber', 'Standort', 'Zweck',
    'Eingecheckt', 'Ausgecheckt', 'Status', 'Notizen'
  ].map(esc).join(';'));

  for (const v of visits) {
    lines.push([
      v.abat_id, v.first_name, v.last_name, v.company, v.email,
      v.host_name, v.location_name, v.purpose,
      fmtDt(v.checked_in_at), fmtDt(v.checked_out_at), v.status, v.notes
    ].map(esc).join(';'));
  }

  lines.push('');
  lines.push(`Gesamt: ${visits.length} Besuch/Besuche`);
  lines.push('');

  // Section 2: Systemereignisse (Audit-Log)
  lines.push('=== SYSTEMEREIGNISSE (AUDIT-LOG) ===');
  lines.push(['Zeitstempel', 'Ereignis', 'Benutzer/Akteur', 'Detail'].map(esc).join(';'));

  for (const e of auditEntries) {
    lines.push([fmtDt(e.ts), e.action, e.actor, e.detail].map(esc).join(';'));
  }

  lines.push('');
  lines.push(`Gesamt: ${auditEntries.length} Ereignis/Ereignisse`);

  const csv = '﻿' + lines.join('\r\n'); // BOM for Excel UTF-8
  const filename = `compliance-bericht-${from}-${to}.csv`;

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.send(csv);
});

module.exports = router;
