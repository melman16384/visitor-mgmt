require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
if (process.env.APP_URL) {
  corsOrigins.push(process.env.APP_URL);
}
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const visitorRoutes = require('./routes/visitors');
const visitRoutes = require('./routes/visits');
const hostRoutes = require('./routes/hosts');
const preregRoutes = require('./routes/preregistrations');

const locationRoutes = require('./routes/locations');
const reportRoutes = require('./routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/hosts', hostRoutes);
app.use('/api/preregistrations', preregRoutes);

app.use('/api/locations', locationRoutes);
app.use('/api/reports', reportRoutes);

const documentRoutes = require('./routes/documents');
app.use('/api', documentRoutes);

const visitPurposesRoutes = require('./routes/visit-purposes');
app.use('/api/visit-purposes', visitPurposesRoutes);

const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes);

const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);

const parkingRoutes = require('./routes/parking');
app.use('/api/parking', parkingRoutes);

const watchlistRoutes = require('./routes/watchlist');
app.use('/api/watchlist', watchlistRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Interner Serverfehler',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

// Initialize DB and start
require('./db/database');
app.listen(PORT, () => {
  console.log(`✓ Besucherverwaltung Backend läuft auf Port ${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`  Umgebung: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
