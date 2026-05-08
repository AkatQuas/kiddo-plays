const otplib = require('otplib');

// Static secret for testing — in production, each admin user should have their own secret stored in DB
const TEST_SECRET = 'AIGSKNCSPS4MRR52SI5XYWOR44FTRXSH';

const otpGuard = (req, res, next) => {
  const token = req.headers['x-otp-token'];

  if (!token) {
    return res.status(401).json({ error: 'Missing x-otp-token header' });
  }

  try {
    const result = otplib.verifySync({ token, secret: TEST_SECRET });
    if (!result || !result.valid) {
      return res.status(401).json({ error: 'Invalid or expired OTP token' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'OTP verification failed' });
  }
};

module.exports = { otpGuard, TEST_SECRET };
