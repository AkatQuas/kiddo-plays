export const ensureEndSlash = (s: string) =>
  s.endsWith('/') ? s : s.concat('/');
