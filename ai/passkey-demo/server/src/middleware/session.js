import { getSession, createSession } from '../redis/session.js';
import { getSessionIdFromCookie, clearSessionCookie, setSessionCookie } from '../utils/cookie.js';

export async function sessionMiddleware(req, res, next) {
  const sid = getSessionIdFromCookie(req);
  if (!sid) {
    req.session = null;
    return next();
  }

  const session = await getSession(sid);
  if (!session) {
    clearSessionCookie(res);
    req.session = null;
    return next();
  }

  req.session = session;
  next();
}

export { setSessionCookie, clearSessionCookie } from '../utils/cookie.js';

export async function createSessionAndSetCookie(req, res, userId) {
  const session = await createSession({
    userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
  });
  setSessionCookie(res, session.sid);
  return session;
}
