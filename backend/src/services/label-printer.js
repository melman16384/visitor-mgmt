const net = require('net');
const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');

// DK-11202: 62×100mm — Brother QL-820NWB at 300dpi
// 62mm × (300/25.4) = 732 → 720 printable dots (90 bytes/row)
// 100mm × (300/25.4) = 1181 raster lines
const PRINT_WIDTH_PX  = 720;
const PRINT_HEIGHT_PX = 1181;
const BYTES_PER_ROW   = Math.ceil(PRINT_WIDTH_PX / 8); // 90

// ── Brother QL raster command builder ─────────────────────────────────────────

function buildRasterData(imageData, widthPx, heightPx) {
  const buf = [];

  // 1. Clear print buffer (200 null bytes)
  buf.push(Buffer.alloc(200, 0x00));

  // 2. Initialize
  buf.push(Buffer.from([0x1B, 0x40]));

  // 3. Switch to raster mode
  buf.push(Buffer.from([0x1B, 0x69, 0x61, 0x01]));

  // 4. Print info: DK-11202, 62×100mm, 1109 raster lines
  const rasterLines = heightPx;
  buf.push(Buffer.from([
    0x1B, 0x69, 0x7A,
    0x8E,       // valid flag (N1)
    0x0A,       // media type: die-cut label (N2)
    0x3E,       // label width: 62mm (N3)
    0x64,       // label length: 100mm (N4)
    rasterLines & 0xFF,
    (rasterLines >> 8) & 0xFF,
    (rasterLines >> 16) & 0xFF,
    (rasterLines >> 24) & 0xFF,
    0x00,       // starting page
    0x00,       // (N11 reserved)
  ]));

  // 5. Auto cut after each label
  buf.push(Buffer.from([0x1B, 0x69, 0x4D, 0x40]));
  buf.push(Buffer.from([0x1B, 0x69, 0x41, 0x01]));
  buf.push(Buffer.from([0x1B, 0x69, 0x4B, 0x08]));

  // 6. No compression (mode 0)
  buf.push(Buffer.from([0x4D, 0x00]));

  // 7. Raster lines — imageData is RGBA (4 bytes/pixel), row-major
  for (let y = 0; y < heightPx; y++) {
    const rowBytes = Buffer.alloc(BYTES_PER_ROW, 0x00);
    for (let x = 0; x < widthPx; x++) {
      const idx = (y * widthPx + x) * 4;
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];
      // Convert to grayscale, threshold at 128 → 1 = dark = print
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (gray < 128) {
        // Brother QL: MSB first, left pixel = bit 7 of byte 0
        const byteIdx = Math.floor(x / 8);
        const bitIdx  = 7 - (x % 8);
        rowBytes[byteIdx] |= (1 << bitIdx);
      }
    }
    // Raster line command: 0x67 0x00 <length> <data>
    buf.push(Buffer.from([0x67, 0x00, BYTES_PER_ROW]));
    buf.push(rowBytes);
  }

  // 8. Print and feed
  buf.push(Buffer.from([0x1A]));

  return Buffer.concat(buf);
}

// ── Label image renderer ───────────────────────────────────────────────────────

async function renderLabelImage({ visitorName, company, hostName, date, time, badgeNumber }) {
  const W = PRINT_WIDTH_PX;  // 720
  const H = PRINT_HEIGHT_PX; // 1181
  const PAD = 24;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ── Header bar (blue, 115px) ─────────────────────────────────────────────────
  ctx.fillStyle = '#004B87';
  ctx.fillRect(0, 0, W, 115);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BESUCHER', W / 2, 80);

  // ── QR code (190×190, top-right of content area) ─────────────────────────────
  const QR_SIZE = 190;
  const QR_X = W - QR_SIZE - PAD;
  const QR_Y = 125;
  let hasQr = false;
  try {
    const qrDataUrl = await QRCode.toDataURL(badgeNumber, { width: QR_SIZE, margin: 1, color: { dark: '#000', light: '#fff' } });
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, QR_X, QR_Y, QR_SIZE, QR_SIZE);
    hasQr = true;
  } catch (_) {}

  // ── Visitor name ─────────────────────────────────────────────────────────────
  const nameAreaW = hasQr ? QR_X - PAD * 2 : W - PAD * 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#111827';
  let nameFontSize = 48;
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  while (ctx.measureText(visitorName).width > nameAreaW && nameFontSize > 26) {
    nameFontSize -= 3;
    ctx.font = `bold ${nameFontSize}px sans-serif`;
  }
  ctx.fillText(visitorName, PAD, 180);

  // ── Company ──────────────────────────────────────────────────────────────────
  if (company) {
    ctx.font = '32px sans-serif';
    ctx.fillStyle = '#374151';
    // Truncate if too wide
    let companyText = company;
    while (ctx.measureText(companyText).width > nameAreaW && companyText.length > 4) {
      companyText = companyText.slice(0, -1);
    }
    if (companyText !== company) companyText += '…';
    ctx.fillText(companyText, PAD, 222);
  }

  // ── Divider ──────────────────────────────────────────────────────────────────
  const div = (y) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
  };

  div(355);

  // ── Host section ─────────────────────────────────────────────────────────────
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('BESUCHT BEI', PAD, 395);

  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#111827';
  let hostText = hostName || '–';
  while (ctx.measureText(hostText).width > W - PAD * 2 && hostText.length > 4) {
    hostText = hostText.slice(0, -1);
  }
  if (hostText !== (hostName || '–')) hostText += '…';
  ctx.fillText(hostText, PAD, 440);

  div(490);

  // ── Date / time ──────────────────────────────────────────────────────────────
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('DATUM & UHRZEIT', PAD, 530);

  ctx.font = '32px sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText(`${date}   ${time} Uhr`, PAD, 572);

  div(615);

  // ── Badge number ─────────────────────────────────────────────────────────────
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('BADGE-NR.', PAD, 655);

  ctx.font = 'bold 50px sans-serif';
  ctx.fillStyle = '#004B87';
  ctx.fillText(badgeNumber || '', PAD, 715);

  // ── Footer bar ───────────────────────────────────────────────────────────────
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, H - 70, W, 70);

  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'center';
  ctx.fillText('Bitte tragen Sie diesen Ausweis sichtbar.', W / 2, H - 24);

  return ctx.getImageData(0, 0, W, H).data;
}

// ── Send to printer via raw TCP (port 9100) ────────────────────────────────────

function sendToPrinter(printerIp, printerPort, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const port = printerPort || 9100;
    socket.setTimeout(8000);

    socket.connect(port, printerIp, () => {
      socket.write(data, (err) => {
        if (err) { socket.destroy(); return reject(err); }
        // Give printer time to accept data before closing
        setTimeout(() => { socket.destroy(); resolve(); }, 1000);
      });
    });

    socket.on('timeout', () => { socket.destroy(); reject(new Error('Drucker-Timeout')); });
    socket.on('error', (err) => { socket.destroy(); reject(err); });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

async function printBadge({ printerIp, printerPort, visitorName, company, hostName, date, time, badgeNumber }) {
  const imageData = await renderLabelImage({ visitorName, company, hostName, date, time, badgeNumber });
  const raster    = buildRasterData(imageData, PRINT_WIDTH_PX, PRINT_HEIGHT_PX);
  await sendToPrinter(printerIp, printerPort, raster);
}

// Test connection only (sends initialize + eject)
function testPrinterConnection(printerIp, printerPort) {
  const data = Buffer.concat([
    Buffer.alloc(200, 0x00),
    Buffer.from([0x1B, 0x40]), // init
    Buffer.from([0x1A]),       // feed/eject
  ]);
  return sendToPrinter(printerIp, printerPort || 9100, data);
}

module.exports = { printBadge, testPrinterConnection };
