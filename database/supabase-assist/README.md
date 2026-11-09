# supabase-assist

A Hono-based **Supabase sidecar** with exactly two jobs:

1. **Issued user id → Supabase RLS** — extract an already-issued user id and mint a compatible JWT. Clients use `anon_key + access_token` under RLS; never ship `service_role`.
2. **Controlled SQL ops** — DynCode (TOTP) gated schema probe / relation listing, with multi-layer SQL validation and a hard `BEGIN READ ONLY` backstop.

Not a full auth product. A helper service next to Supabase.

---

## Architecture focus: `X-Dyn-Code` (TOTP)

```
ops / build tool                supabase-assist                 Postgres
     │                                │                             │
     │  X-Dyn-Code: 6-digit TOTP      │                             │
     │  Cookie: (bucket key only)     │                             │
     ├───────────────────────────────►│                             │
     │                                │  verifyTotp ±1 window       │
     │                                │  fail×3 / 30s → lock 30m    │
     │                                │  opaque "unauthorized"      │
     │                                ├────────────────────────────►│
     │                                │  validateSql + READ ONLY    │
```

| Piece | Behavior |
|------|----------|
| Header | `X-Dyn-Code`, 6 digits, 30s step, ±1 window for clock skew |
| Secret | `DYN_CODE_SECRET` (base32); verification accepts base32 **or** raw UTF-8 key bytes |
| Rate bucket | Cookie SHA-256 (not IP — friendlier behind k8s / gateways) |
| Lockout | 3 failures in 30s → lock 30 minutes; success clears the bucket |
| Responses | 401 / 429 both return opaque `unauthorized` (anti feedback-driven brute force) |
| Role | **Second confirmation**, not identity auth; real power lives in `DATABASE_URL` + gateway |

Print the current code:

```bash
pnpm gen-totp
```

---

## Capabilities

### Auth bridge

Upstream SSO/gateway already authenticated the user. This service only **reads that issued id** and signs a Supabase-compatible JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/get-user-config` | Read cookie `uid` → mint JWT + optional base64 anon key |
| POST | `/convert-uid` | Body `{ id, role?, expiresInSeconds? }` explicit mint (server-to-server) |
| GET | `/health` | Liveness |

**User id extraction (placeholder)**

- Cookie path: `parseUserIdFromCookie` reads `uid=<id>` only (`src/lib/cookie-uid.ts`)
- Body path: `normalizeUserId` coerces `id` to a non-empty string
- No tenant suffix / identify-flag logic — swap in your SSO adapter when integrating

**JWT claims**

| Claim | Value |
|-------|--------|
| `sub` | Deterministic uuidv5 of the user id |
| `user_id` | Upstream-issued user id (fixed claim name) |
| `role` / `aud` | `authenticated` (Supabase defaults) |

Suggested RLS:

```sql
create policy "owner" on my_table
  for all using (user_id = (auth.jwt() ->> 'user_id'));
```

Example responses:

```jsonc
// GET /get-user-config
{
  "supabaseKey": "<base64 anon key or empty>",
  "supabaseAccessToken": "<jwt>",
  "uuid": "<deterministic sub>",
  "userId": "1001",
  "claim": "user_id",
  "expiresIn": 3600,
  "expiresAt": 1710000000
}

// POST /convert-uid  { "id": "1001" }
{
  "uuid": "<deterministic sub>",
  "userId": "1001",
  "accessToken": "<jwt>",
  "claim": "user_id",
  "expiresIn": 3600,
  "expiresAt": 1710000000
}
```

### Schema ops (requires `X-Dyn-Code`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/schema/relations` | List non-system tables / views |
| POST | `/schema/probe` | `{ sql, mode?: 'read'\|'schema', rowLimit?, timeoutMs? }` |

- `read`: query-class statements only; executed inside `BEGIN READ ONLY`
- `schema`: allows `CREATE TABLE/INDEX/SCHEMA`, `ALTER TABLE ... ADD ...`, `COMMENT ON`; blocks DROP / DML / etc.

---

## Configuration

See `.env.example`. Relevant knobs:

| Env | Purpose |
|-----|---------|
| `SUPABASE_JWT_SECRET` | Signs access tokens (must match Supabase JWT secret) |
| `SUPABASE_ANON_KEY` | Optional; returned (base64) by `/get-user-config` |
| `DATABASE_URL` | Privileged Postgres for `/schema/*` |
| `DYN_CODE_SECRET` | Shared TOTP secret for `X-Dyn-Code` |
| `ACCESS_TOKEN_EXPIRES_IN` | Default token TTL in seconds (default `3600`) |
| `JWT_SUB_UUIDV5_NAMESPACE` | uuidv5 namespace for deterministic `sub` |
| `DEBUG_DYN_CODE` | `1` → log expected TOTP windows on miss |

There is **no** env for cookie name, tenant suffix, or JWT claim name — those stay fixed placeholders in code.

---

## Run

```bash
cp .env.example .env
# set SUPABASE_JWT_SECRET / DYN_CODE_SECRET / DATABASE_URL

pnpm install
pnpm dev
```

Listens on `http://localhost:3010` by default.

Examples:

```bash
# Mint from cookie uid (already issued by upstream)
curl -s 'http://localhost:3010/get-user-config' -H "Cookie: uid=1001"

# Mint from explicit id
curl -s 'http://localhost:3010/convert-uid' \
  -H "Content-Type: application/json" \
  -d '{"id":"1001"}'

# Controlled probe
curl -s 'http://localhost:3010/schema/probe' \
  -H "Content-Type: application/json" \
  -H "X-Dyn-Code: $(pnpm -s gen-totp)" \
  -H "Cookie: uid=ops" \
  -d '{"sql":"select 1 as ok","mode":"read"}'
```
