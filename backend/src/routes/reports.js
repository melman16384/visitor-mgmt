const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Empfang sieht nur die eigenen Standorte; Admin sieht alles oder kann per
// location_id-Query-Param gezielt einen Standort filtern.
function locationScope(req) {
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin) {
    const ids = req.user.location_ids;
    if (ids && ids.length > 0) {
      return { sql: `AND v.location_id IN (${ids.map(() => '?').join(',')})`, params: ids };
    }
    return { sql: '', params: [] };
  }
  if (req.query.location_id) {
    return { sql: 'AND v.location_id = ?', params: [req.query.location_id] };
  }
  return { sql: '', params: [] };
}

// GET /daily?date=YYYY-MM-DD
router.get('/daily', authenticate, (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const scope = locationScope(req);

  const rows = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company, vi.email,
           COALESCE(h.name, v.host_name_free) as host_name, l.name as location_name
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    WHERE date(v.checked_in_at) = ? ${scope.sql}
    ORDER BY v.checked_in_at ASC
  `).all(targetDate, ...scope.params);

  const stats = {
    total: rows.length,
    active: rows.filter(r => r.status === 'active').length,
    completed: rows.filter(r => r.status === 'completed').length,
  };

  res.json({ date: targetDate, stats, visits: rows });
});

// GET /monthly?year=YYYY&month=MM
router.get('/monthly', authenticate, (req, res) => {
  const now = new Date();
  const year = req.query.year || now.getFullYear();
  const month = req.query.month || (now.getMonth() + 1);
  const monthStr = String(month).padStart(2, '0');
  const from = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${lastDay}`;
  const scope = locationScope(req);

  const visits = db.prepare(`
    SELECT v.*, vi.first_name, vi.last_name, vi.company,
           COALESCE(h.name, v.host_name_free) as host_name
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    WHERE date(v.checked_in_at) BETWEEN ? AND ? ${scope.sql}
  `).all(from, to, ...scope.params);

  const topHosts = db.prepare(`
    SELECT h.name, COUNT(*) as count
    FROM visits v
    JOIN hosts h ON v.host_id = h.id
    WHERE date(v.checked_in_at) BETWEEN ? AND ? ${scope.sql}
    GROUP BY h.id ORDER BY count DESC LIMIT 5
  `).all(from, to, ...scope.params);

  const topCompanies = db.prepare(`
    SELECT vi.company, COUNT(*) as count
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    WHERE date(v.checked_in_at) BETWEEN ? AND ? AND vi.company IS NOT NULL ${scope.sql}
    GROUP BY vi.company ORDER BY count DESC LIMIT 5
  `).all(from, to, ...scope.params);

  const daily = db.prepare(`
    SELECT date(checked_in_at) as date, COUNT(*) as count
    FROM visits v WHERE date(checked_in_at) BETWEEN ? AND ? ${scope.sql}
    GROUP BY date ORDER BY date ASC
  `).all(from, to, ...scope.params);

  res.json({
    year, month,
    total: visits.length,
    topHosts,
    topCompanies,
    dailyBreakdown: daily,
  });
});

// GET /evacuation
router.get('/evacuation', authenticate, (req, res) => {
  const ids = req.user?.location_ids;
  const locSql = ids && ids.length > 0
    ? `AND v.location_id IN (${ids.map(() => '?').join(',')})`
    : '';
  const locParams = ids && ids.length > 0 ? ids : [];

  const rows = db.prepare(`
    SELECT v.id, v.checked_in_at, v.purpose,
           vi.first_name, vi.last_name, vi.company,
           COALESCE(h.name, v.host_name_free) as host_name,
           l.id as location_id, l.name as location_name, l.address as location_address
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    WHERE v.status = 'active' ${locSql}
    ORDER BY COALESCE(l.name, 'zzz') ASC, v.checked_in_at ASC
  `).all(...locParams);

  // Group by location
  const grouped = {};
  for (const row of rows) {
    const key = row.location_name || 'Kein Standort';
    if (!grouped[key]) grouped[key] = { location_name: key, location_address: row.location_address, visitors: [] };
    grouped[key].visitors.push(row);
  }

  res.json({
    total: rows.length,
    locations: Object.values(grouped),
    visitors: rows,
    generated_at: new Date().toISOString(),
  });
});

// GET /export?from=&to=&format=csv — CSV-Download nur für Admin, JSON-Vorschau für alle (Standort-gescopt)
router.get('/export', authenticate, (req, res) => {
  const { from, to, format = 'csv' } = req.query;
  if (format === 'csv' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Export nur für Admin verfügbar' });
  }
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];
  const scope = locationScope(req);

  const rows = db.prepare(`
    SELECT v.id, v.purpose, v.status, v.notes,
           v.checked_in_at, v.checked_out_at,
           vi.first_name, vi.last_name, vi.company, vi.email,
           COALESCE(h.name, v.host_name_free) as host_name,
           l.name as location_name
    FROM visits v
    JOIN visitors vi ON v.visitor_id = vi.id
    LEFT JOIN hosts h ON v.host_id = h.id
    LEFT JOIN locations l ON v.location_id = l.id
    WHERE date(v.checked_in_at) BETWEEN ? AND ? ${scope.sql}
    ORDER BY v.checked_in_at DESC
  `).all(fromDate, toDate, ...scope.params);

  if (format === 'csv') {
    const headers = ['ID', 'Vorname', 'Nachname', 'Firma', 'E-Mail',
      'Gastgeber', 'Standort', 'Zweck', 'Status',
      'Eingecheckt', 'Ausgecheckt', 'Notizen'];

    const csvLines = [headers.join(';')];
    for (const r of rows) {
      csvLines.push([
        r.id, r.first_name, r.last_name, r.company || '', r.email || '',
        r.host_name || '', r.location_name || '', r.purpose || '',
        r.status === 'active' ? 'Anwesend' : 'Ausgecheckt',
        r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('de-DE') : '',
        r.checked_out_at ? new Date(r.checked_out_at).toLocaleString('de-DE') : '',
        r.notes || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    }

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="besucher-export-${fromDate}-${toDate}.csv"`,
    });
    res.send('﻿' + csvLines.join('\n'));
  } else {
    res.json(rows);
  }
});

module.exports = router;
