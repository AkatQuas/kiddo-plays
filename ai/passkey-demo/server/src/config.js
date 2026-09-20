const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  rpId: env.RP_ID || 'localhost',
  rpName: env.RP_NAME || 'Passkey Demo',
  origin: env.ORIGIN || 'http://localhost:5173',
  cookieSecure: env.COOKIE_SECURE === 'true',
  sessionTtlSec: Number(env.SESSION_TTL_SEC || 86400),
  challengeTtlSec: Number(env.CHALLENGE_TTL_SEC || 300),
  nodeEnv: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
};

export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

export function validateUsername(raw) {
  const username = String(raw || '').trim();
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: { code: 'INVALID_USERNAME', message: 'Username must be 3-32 characters: letters, numbers, _ or -' } };
  }
  return { ok: true, username };
}

export function registerChallengeKey(username) {
  return `challenge:register:${username}`;
}

export function loginChallengeKey(username) {
  return `challenge:login:${username}`;
}

export function passkeyChallengeKey(userId) {
  return `challenge:passkey:${userId}`;
}
