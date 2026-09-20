export function sendOk(res, data = {}, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function sendError(res, code, message, status = 400) {
  return res.status(status).json({ ok: false, error: { code, message } });
}
