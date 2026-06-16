const QRCode = require('qrcode');

async function generateQR(data) {
  return QRCode.toBuffer(String(data), { type: 'png', width: 350, margin: 3 });
}

async function generateQRDataURL(data) {
  return QRCode.toDataURL(String(data), { width: 350, margin: 3 });
}

module.exports = { generateQR, generateQRDataURL };
