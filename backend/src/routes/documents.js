const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const docsDir = path.join(__dirname, '../../uploads/documents');
const sigsDir = path.join(__dirname, '../../uploads/signatures');
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
if (!fs.existsSync(sigsDir)) fs.mkdirSync(sigsDir, { recursive: true });

const docStorage = multer.diskStorage({
  destination: docsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur PDF, DOC und DOCX erlaubt'));
  },
});

const MAGIC_BYTES = {
  '.pdf': [{ offset: 0, bytes: Buffer.from('%PDF-', 'ascii') }],
  '.doc': [{ offset: 0, bytes: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) }],
  '.docx': [{ offset: 0, bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]) }],
};

function hasValidMagicBytes(filePath, ext) {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return false;
  const maxLen = Math.max(...signatures.map((s) => s.offset + s.bytes.length));
  const buf = Buffer.alloc(maxLen);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, maxLen, 0);
  fs.closeSync(fd);
  return signatures.some((s) => buf.slice(s.offset, s.offset + s.bytes.length).equals(s.bytes));
}

// Upload a document for a visit (no auth for kiosk use)
router.post('/visits/:visitId/documents', uploadDoc.single('document'), (req, res) => {
  const { visitId } = req.params;
  const { document_type = 'nda' } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!hasValidMagicBytes(req.file.path, ext)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Datei entspricht nicht dem angegebenen Dateityp' });
  }

  const visit = db.prepare('SELECT id FROM visits WHERE id = ?').get(visitId);
  if (!visit) return res.status(404).json({ error: 'Besuch nicht gefunden' });

  const doc = db.prepare(`
    INSERT INTO visit_documents (visit_id, filename, original_name, document_type)
    VALUES (?, ?, ?, ?)
  `).run(visitId, req.file.filename, req.file.originalname, document_type);

  res.json({ id: doc.lastInsertRowid, filename: req.file.filename, original_name: req.file.originalname });
});

// Save signature for a document
router.post('/documents/:docId/signature', express.raw({ type: 'image/png', limit: '5mb' }), (req, res) => {
  const { docId } = req.params;
  const doc = db.prepare('SELECT * FROM visit_documents WHERE id = ?').get(docId);
  if (!doc) return res.status(404).json({ error: 'Dokument nicht gefunden' });

  const sigFilename = `sig-${docId}-${Date.now()}.png`;
  const sigPath = path.join(sigsDir, sigFilename);
  fs.writeFileSync(sigPath, req.body);

  db.prepare('UPDATE visit_documents SET signature_path = ?, signed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(sigFilename, docId);

  res.json({ success: true, signature: sigFilename });
});

// Save signature as base64 JSON
router.post('/documents/:docId/signature-base64', express.json({ limit: '5mb' }), (req, res) => {
  const { docId } = req.params;
  const { signature } = req.body;
  if (!signature) return res.status(400).json({ error: 'Keine Unterschrift' });

  const doc = db.prepare('SELECT * FROM visit_documents WHERE id = ?').get(docId);
  if (!doc) return res.status(404).json({ error: 'Dokument nicht gefunden' });

  const base64Data = signature.replace(/^data:image\/png;base64,/, '');
  const sigFilename = `sig-${docId}-${Date.now()}.png`;
  const sigPath = path.join(sigsDir, sigFilename);
  fs.writeFileSync(sigPath, Buffer.from(base64Data, 'base64'));

  db.prepare('UPDATE visit_documents SET signature_path = ?, signed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(sigFilename, docId);

  res.json({ success: true, signature: sigFilename });
});

// Get documents for a visit
router.get('/visits/:visitId/documents', authenticate, (req, res) => {
  const docs = db.prepare('SELECT * FROM visit_documents WHERE visit_id = ?').all(req.params.visitId);
  res.json(docs);
});

// Download document
router.get('/documents/:docId/download', authenticate, (req, res) => {
  const doc = db.prepare('SELECT * FROM visit_documents WHERE id = ?').get(req.params.docId);
  if (!doc) return res.status(404).json({ error: 'Nicht gefunden' });
  const filePath = path.join(docsDir, doc.filename);
  res.download(filePath, doc.original_name);
});

module.exports = router;
