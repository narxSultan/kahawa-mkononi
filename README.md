# KAHAWA MKONONI (MVP Phase 1)

Centralized coffee service management MVP for managing customers, service centres, sales/cups, stock control, and dashboard KPIs.

## Monorepo layout

- `backend/` Node.js + Express + GraphQL (Apollo) + PostgreSQL (Prisma)
- `frontend/` Angular dashboard (mobile‑first)

## Prerequisites

- Node.js 20+
- Docker (recommended for PostgreSQL)

## Quick start (local)

1) Start PostgreSQL:

```bash
docker compose up -d db
```

2) Configure backend env:

```bash
cp backend/.env.example backend/.env
```

3) Install dependencies:

```bash
npm install
```

4) Initialize database (Prisma):

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

5) Run dev servers:

```bash
cd backend && npm run dev
cd ../frontend && npm run start
```

- API playground: `http://localhost:4000/graphql`
- Web app: `http://localhost:4200`

## Customer ordering (self‑service)

- Register: `http://localhost:4200/customer/register`
- Login: `http://localhost:4200/customer/login`
- Flow: customer creates order → staff marks it complete → customer acknowledges via “order complete” dialog (status becomes `COMPLETED` only after OK).

## Run with Docker (API + Web + DB)

```bash
docker compose -f docker-compose.full.yml up --build
```

- Web: `http://localhost:8080`
- API: `http://localhost:4000/graphql`

## Environment configuration

Backend:
- Copy `backend/.env.example` to `backend/.env` and update secrets.
- `CORS_ORIGINS` is a comma-separated allowlist (e.g. `http://localhost:4200`).

Frontend:
- Defaults assume `http://localhost:4000/graphql`.
- Optional runtime overrides:
  - set `window.__KAHAWA_API_URL__`
  

## Default accounts (seed)

- Admin: `admin@kahawa.local` / `Admin@12345`
- Manager: `manager@kahawa.local` / `Manager@12345`
- Staff: `staff@kahawa.local` / `Staff@12345`
- Call Centre Agent: `agent@kahawa.local` / `Agent@12345`

Change these immediately in production.

## When login fails after schema changes

If you recently pulled changes that added new tables (users, notifications, duties, handovers, activity logs), reset and reseed your local DB:

```bash
cd backend
npx prisma migrate reset
npx prisma db seed
```

## If `npm install` fails (DNS / registry)

If you see errors like `ENOTFOUND registry.npmjs.org`, check your network/DNS or set the registry explicitly:

```bash
npm config set registry https://registry.npmjs.org/
npm install
```
