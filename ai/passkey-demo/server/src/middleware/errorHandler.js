import { sendError } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.warn('[error]', err.message || err);

  if (err.name === 'NotAllowedError' || err.message?.includes('cancel')) {
    return sendError(res, 'USER_CANCELLED', 'Operation was cancelled', 400);
  }

  return sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}
