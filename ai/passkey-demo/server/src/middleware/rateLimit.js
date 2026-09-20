import rateLimit from 'express-rate-limit';

export const webAuthnRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});
