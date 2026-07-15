require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Nginx reverse proxy (needed for rate limiting + X-Forwarded-For)
app.set('trust proxy', 1);

// Ensure uploads directory
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false, // Managed by nginx
}));

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

// Protected uploads: photos, documents, signatures all require auth
app.use('/uploads/photos', authenticate, express.static(path.join(uploadsDir, 'photos')));
app.use('/uploads/documents', authenticate, express.static(path.join(uploadsDir, 'documents')));
app.use('/uploads/signatures', authenticate, express.static(path.join(uploadsDir, 'signatures')));

// Rate limiting on login endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Audit log service
const { cleanup: auditCleanup } = require('./services/audit-log');

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const visitorRoutes = require('./routes/visitors');
const visitRoutes = require('./routes/visits');
const hostRoutes = require('./routes/hosts');
const preregRoutes = require('./routes/preregistrations');

const locationRoutes = require('./routes/locations');
const reportRoutes = require('./routes/reports');

app.use('/api/auth', loginLimiter, authRoutes);
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


app.use('/api/audit-log', require('./routes/audit-log'));
app.use('/api/host-portal', loginLimiter, require('./routes/host-portal'));
app.use('/api/ad-sync', require('./routes/ad-sync'));

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
auditCleanup();
const { scheduleNext } = require('./services/auto-checkout');
const { scheduleExpiry } = require('./services/prereg-expiry');
const { scheduleNext: scheduleAdSync } = require('./services/ad-sync-schedule');
app.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ Besucherverwaltung Backend läuft auf Port ${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`  Umgebung: ${process.env.NODE_ENV || 'development'}`);
  scheduleNext();
  scheduleExpiry();
  scheduleAdSync();
});

module.exports = app;
