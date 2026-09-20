import { config } from '../config.js';

const COOKIE_NAME = 'session_id';

export function setSessionCookie(res, sid) {
  res.cookie(COOKIE_NAME, sid, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTtlSec * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });
}

export function getSessionIdFromCookie(req) {
  return req.cookies?.[COOKIE_NAME] || null;
}
