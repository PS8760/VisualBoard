# Visual White Board

Infinite canvas whiteboard with real-time collaboration, comments, version history and document attachments.

## Stack

- **Frontend** — React 19 + Vite + Tailwind 4, Zustand stores, Fabric.js canvas, socket.io-client
- **Backend** — Node 20 + TypeScript, Express 4, Prisma + PostgreSQL, Zod validation, socket.io
- **Infra** — Redis (optional, graceful degradation), local/object storage abstraction, Docker Compose

## Repository layout

```
backend/   Express API, Prisma schema/migrations/seed, socket server, vitest suite
frontend/  React app, API layer (axios), stores, vitest + Playwright tests
docs/      API reference
```

## Quick start (local)

### 1. Database

```bash
cd backend
cp .env.example .env        # then edit DATABASE_URL if needed
npx prisma migrate dev      # apply migrations + generate client
npm run prisma:seed         # demo users + a board with sample content
```

### 2. Backend

```bash
cd backend
npm ci
npm run dev                 # http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm ci
npm run dev                 # http://localhost:5174 (proxies /api and /socket.io to :8000)
```

Log in with a seeded account (see below) or register a new one.

## Seeded demo accounts

Created by `backend/prisma/seed.ts`:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@example.com` | `Password123!` |
| Editor | `editor@example.com` | `Password123!` |
| Viewer | `viewer@example.com` | `Password123!` |

These are development-only credentials and must not be used in production.

## Backend environment variables

See `backend/.env.example` for the full annotated template. Key variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8000` | HTTP port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `DATABASE_URL_TEST` | — | Test database (vitest uses it via `setup-env.ts`) |
| `JWT_SECRET` | — | ≥32 chars; use a long random value |
| `REDIS_URL` | — | Optional; the app runs without Redis |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Comma-separated CORS origins |
| `STORAGE_DRIVER` / `LOCAL_UPLOAD_DIR` | `local` / `./uploads` | Document storage |
| `RATE_LIMIT_*` | tuned defaults | Per-endpoint rate limits |
| `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | — | OAuth (server-side exchange; optional) |

Frontend: `VITE_API_URL` (default `/api/v1`, same-origin) and `VITE_SOCKET_URL` (default same-origin).

## Testing

```bash
# Backend — unit + integration (uses DATABASE_URL_TEST, migrates it automatically)
cd backend && npm test

# Frontend — unit + component tests
cd frontend && npm test

# End-to-end — needs the backend running with a seeded DB, then:
cd frontend && npx playwright install chromium && npm run test:e2e
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build, and the Playwright suite on every push/PR.

## API

Full reference in [`docs/API.md`](docs/API.md). Responses use a consistent envelope:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid request data", "details": [] } }
```

## Docker

```bash
docker compose up --build
```

Runs Postgres + Redis + backend (:8000, with healthchecks, migrations on boot) + frontend (nginx :5174, proxying `/api` and `/socket.io`). Set `JWT_SECRET` when running in production.

## Production notes

- Set `NODE_ENV=production` and a strong `JWT_SECRET`.
- Use the object-storage driver instead of local disk for horizontally scaled deployments.
- OAuth callback URLs must be registered in the provider consoles.
