# Supabase tester

A tiny project using express to connect supabase database.

Create a start up project using `https://supabase.com/dashboard`.

1. Client connection, API key like `Publishable` and `Secret` or Legacy key like `anon` and `service_role`.

2. Row Level Security

3. Migrations, [init_data.sql](./migrations/init_data.sql) for initialize database.

---

This server come with an [OTP guard](./src/middleware/otpGuard.js) for demo.

Visit `GET /api/otp/setup` to set up OTP by scanning QRcode or Secret directly.

Then `GET /api/admin` to access secret data.

[generateOtpToken.js](./helpers/generateOtpToken.js) will be useful for auto regression in CI.

---

# Why Use Supabase? vs Raw PostgreSQL vs MongoDB

## First: What Supabase Actually Is

Supabase is **PostgreSQL + full backend platform**
It’s not a new database — it’s **managed Postgres** wrapped with:

- Auto REST/GraphQL API
- Auth (email/google/github/phone)
- Realtime subscriptions
- Storage (file uploads)
- RLS (Row Level Security)
- Dashboard, migrations, database UI
- SDKs for JS/Flutter/React/Vue/Android/iOS

So:

> **Supabase = PostgreSQL + Ready-made Backend Services**

# 1. Supabase vs Raw PostgreSQL

### Why use Supabase instead of plain self-hosted Postgres?

✅ **Supabase Wins**

- No need to build **API layer** (auto-generated REST)
- Built-in **authentication system** (you don’t code login/signup)
- Built-in **Realtime** (listen to DB changes live)
- Built-in **File Storage** (S3-like)
- Built-in **RLS security** out of box
- No DevOps: managed DB, backups, scaling, updates
- Simple dashboard to edit tables, run queries, manage users
- SDKs ready for every frontend framework

❌ Raw Postgres only

- Just a database
- You have to **build everything yourself**: API, Auth, File storage, Realtime, Security, Dashboard
- Need DevOps to host, maintain, backup, scale

**Verdict**:
Use Supabase if you want **Postgres power without building backend from scratch**.

# 2. Supabase vs MongoDB

### Core Difference

- **MongoDB**: NoSQL, document database
- **Supabase**: SQL (Postgres), relational database + backend platform

## When Supabase is Better than MongoDB

✅ **Choose Supabase if:**

1. You have **related data** (users → posts → comments → orders)
   Relational joins/populate are **way more reliable** than Mongo refs.
2. You need **strict data structure** (schema, constraints, foreign keys)
3. You need **strong data integrity** (no duplicate bad data)
4. You want **RLS security** at database level
5. You want built-in **Auth, Realtime, Storage** without extra tools
6. You prefer SQL queries (powerful filtering, aggregation)
7. You need complex queries, reporting, analytics

## When MongoDB is Better than Supabase

✅ **Choose MongoDB if:**

1. Your data is **unstructured / flexible schema** (dynamic fields every document different)
2. You need rapid prototyping with **no table schema setup**
3. You heavily use nested big documents, rarely do joins
4. You don’t want to think about relations/foreign keys at all
5. You love Mongoose ORM workflow and `populate()`

# 3. Simple Comparison Table

| Feature                   | Supabase       | Raw PostgreSQL | MongoDB          |
| ------------------------- | -------------- | -------------- | ---------------- |
| Database type             | SQL (Postgres) | SQL            | NoSQL Document   |
| Relational joins/populate | ✅ Native      | ✅ Native      | Manual refs      |
| Built-in Auth             | ✅ Yes         | ❌ No          | ❌ No            |
| Auto REST API             | ✅ Yes         | ❌ No          | ❌ No            |
| Realtime live updates     | ✅ Yes         | ❌ No          | Third party only |
| File Storage              | ✅ Built-in    | ❌ No          | ❌ No            |
| Schema strict             | ✅ Strong      | ✅ Strong      | ❌ Flexible      |
| Easy for frontend devs    | ✅ Perfect     | ❌ Hard        | ✅ Easy          |
| DevOps needed             | ❌ None        | ✅ Yes         | ✅ Yes           |
| RLS Database Security     | ✅ Built-in    | Manual setup   | Manual setup     |

# 4. Who Should Use Supabase?

Use Supabase if you are:

- Frontend dev (React/Vue/Next/Flutter) **no backend dev**
- Building SaaS, social app, e-commerce, blog, task app
- Want relational data but don’t want to code Node/Express backend
- Want realtime features (chat, live feed, live dashboard)
- Want ready auth + file uploads + database all in one place

# 5. Quick Final Rules

1. **Use Supabase** → You want SQL relations + ready backend (auth/api/realtime/storage) without DevOps.
2. **Use Raw Postgres** → You need full custom backend, enterprise control, self-host everything.
3. **Use MongoDB** → Unstructured data, flexible schema, no complex relations, love NoSQL.
