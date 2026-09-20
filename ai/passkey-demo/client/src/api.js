async function request(method, path, body) {
  const options = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(path, options);
  const json = await res.json().catch(() => ({ ok: false, error: { code: 'PARSE_ERROR', message: 'Invalid response' } }));

  return { status: res.status, ...json };
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  delete: (path) => request('DELETE', path),
};
