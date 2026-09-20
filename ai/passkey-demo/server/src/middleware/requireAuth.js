import { sendError } from '../utils/response.js';

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }
  next();
}
