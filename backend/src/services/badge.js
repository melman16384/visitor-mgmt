const PDFDocument = require('pdfkit');

// A6 = 148×105mm  →  419.53×297.64 pt  (1pt = 1/72 inch)
async function generateBadge({ visitorName, company, hostName, date, time, qrBuffer }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A6', margin: 0, layout: 'landscape' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;   // ~419 pt (landscape A6)
    const H = doc.page.height;  // ~298 pt

    const BLUE    = '#004B87';
    const LBLUE   = '#00A3E0';
    const DARK    = '#53565A';
    const MID     = '#6B7280';
    const LIGHT   = '#F3F4F6';
    const WHITE   = '#FFFFFF';
    const PAD     = 18;

    // ── Left accent stripe ──────────────────────────────────────────────────────
    doc.rect(0, 0, 8, H).fill(LBLUE);

    // ── Header band ────────────────────────────────────────────────────────────
    doc.rect(8, 0, W - 8, 52).fill(BLUE);

    doc.fontSize(9).fillColor('#9ADBE8').font('Helvetica')
      .text('BESUCHERAUSWEIS  ·  VISITOR BADGE', 8 + PAD, 10, { width: W - 8 - PAD * 2 - 80, align: 'left' });

    // Date + time top-right
    doc.fontSize(9).fillColor(WHITE).font('Helvetica')
      .text(`${date}  ${time}`, W - 130, 10, { width: 112, align: 'right' });

    doc.fontSize(20).fillColor(WHITE).font('Helvetica-Bold')
      .text('abat AG', 8 + PAD, 26, { width: W - 8 - PAD * 2, align: 'left' });

    // ── QR code – top right ────────────────────────────────────────────────────
    const QR = 84;
    if (qrBuffer) {
      try { doc.image(qrBuffer, W - QR - PAD, 58, { width: QR, height: QR }); } catch (_) {}
    }

    // ── Visitor name ───────────────────────────────────────────────────────────
    const nameAreaW = W - PAD * 2 - QR - 16 - 8;

    doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold')
      .text(visitorName, 8 + PAD, 62, { width: nameAreaW, lineBreak: false });

    if (company) {
      doc.fontSize(11).fillColor(MID).font('Helvetica')
        .text(company, 8 + PAD, 88, { width: nameAreaW });
    }

    // ── Horizontal rule ────────────────────────────────────────────────────────
    const ruleY = 154;
    doc.rect(8 + PAD, ruleY, W - 8 - PAD * 2, 1).fill('#E5E7EB');

    // ── Info grid ──────────────────────────────────────────────────────────────
    const col1X = 8 + PAD;
    const infoY  = ruleY + 12;

    // Label style
    const lbl = (text, x, y) =>
      doc.fontSize(7).fillColor(MID).font('Helvetica').text(text.toUpperCase(), x, y);
    const val = (text, x, y, opts = {}) =>
      doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text(text || '–', x, y, opts);

    lbl('Gastgeber / Host', col1X, infoY);
    val(hostName || '–', col1X, infoY + 10, { width: W - PAD * 2 - 8 });

    // ── Bottom rule ────────────────────────────────────────────────────────────
    const footY = H - 26;
    doc.rect(8, footY - 2, W - 8, 1).fill('#E5E7EB');

    // Footer
    doc.rect(8, footY, W - 8, H - footY).fill(LIGHT);
    doc.fontSize(7.5).fillColor(MID).font('Helvetica')
      .text('Bitte tragen Sie diesen Ausweis während Ihres gesamten Aufenthalts sichtbar.', 8 + PAD, footY + 8, { width: W - 8 - PAD * 2, align: 'center' });

    doc.end();
  });
}

module.exports = { generateBadge };
