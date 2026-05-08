const express = require('express');
const otplib = require('otplib');
const QRCode = require('qrcode');

const router = express.Router();

router.get('/', async (req, res) => {
  res.json({
    message: 'hello, this is admin'
  })
});

module.exports = router;
