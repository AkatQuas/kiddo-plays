function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`missing env: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number.parseInt(process.env.PORT ?? '3010', 10),
  supabaseJwtSecret: () => required('SUPABASE_JWT_SECRET'),
  supabaseAnonKey: () => optional('SUPABASE_ANON_KEY'),
  databaseUrl: () => required('DATABASE_URL'),
  dynCodeSecret: () => required('DYN_CODE_SECRET'),
  accessTokenExpiresIn: () => {
    const n = Number.parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN ?? '3600', 10);
    return Number.isFinite(n) && n > 0 ? n : 3600;
  },
  /** uuidv5 namespace for deterministic JWT `sub` derived from user id */
  uuidv5Namespace: () =>
    optional('JWT_SUB_UUIDV5_NAMESPACE', '9f8e7d6c-5b4a-41a0-9c21-0fedcba98765'),
  debugDynCode: () => process.env.DEBUG_DYN_CODE === '1',
};
