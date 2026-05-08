/**
 * Generates a valid OTP token for CI / test use.
 * Replicates the same secret used by otpGuard middleware.
 *
 * Usage:
 *   const otpToken = generateOtpToken();
 *   // or from CLI: node tests/helpers/generateOtpToken.js
 */
const otplib = require('otplib');

const TEST_SECRET = 'AIGSKNCSPS4MRR52SI5XYWOR44FTRXSH';

function generateOtpToken(secret = TEST_SECRET) {
  return otplib.generate(secret);
}

if (require.main === module) {
  console.log(generateOtpToken());
}

module.exports = { generateOtpToken, TEST_SECRET };