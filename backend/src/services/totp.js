const { authenticator } = require('otplib');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Allow ±2 time-steps (60s) of drift/latency — window:0 rejects valid codes
// that arrive even a second late due to typing or network round-trip time.
authenticator.options = { window: 2 };

function generateSecret() {
  return authenticator.generateSecret();
}

function otpauthUrl(secret, email, issuer) {
  return authenticator.keyuri(email, issuer, secret);
}

function verifyToken(secret, token) {
  if (!secret || !token) return false;
  try {
    return authenticator.check(String(token).replace(/\s+/g, ''), secret);
  } catch {
    return false;
  }
}

function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(5).toString('hex')); // 10 hex chars
  }
  return codes;
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map(c => bcrypt.hash(c, 10)));
}

// Returns the remaining hash list with the matched hash removed, or null if no match.
async function consumeBackupCode(hashedCodes, code) {
  const list = JSON.parse(hashedCodes || '[]');
  for (let i = 0; i < list.length; i++) {
    if (await bcrypt.compare(code, list[i])) {
      list.splice(i, 1);
      return list;
    }
  }
  return null;
}

module.exports = { generateSecret, otpauthUrl, verifyToken, generateBackupCodes, hashBackupCodes, consumeBackupCode };
