const express = require('express');
const QRCode = require('qrcode');
const otplib = require('otplib');
const { TEST_SECRET } = require('../middleware/otpGuard');

const router = express.Router();

// Build the standard otpauth:// URI manually (issuer:label, TOTP, SHA1, 30s period, 6 digits)
function buildOtpauthUri(label, issuer, secret) {
  const encodedLabel = encodeURIComponent(`${issuer}:${label}`);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// GET /setup-otp — returns the OTP auth URL and a QR code data URI for the static secret
router.get('/setup', async (req, res) => {
  const serviceName = 'SupabaseTester';
  const otpauth = buildOtpauthUri('admin', serviceName, TEST_SECRET);

  try {
    const qrDataUri = await QRCode.toDataURL(otpauth);
    res.json({
      secret: TEST_SECRET,
      otpauth,
      qrcode: qrDataUri,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// POST /verify-setup — verify an OTP token (useful for testing that scanning worked)
router.post('/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Missing token in body' });
  }

  const isValid = otplib.verifySync({ token, secret: TEST_SECRET });
  res.json({ valid: isValid });
});

module.exports = router
