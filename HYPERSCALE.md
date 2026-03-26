# HYPERSCALE: Retrevr Production Roadmap

This document outlines the engineering path to transform the Retrevr Insurance Platform from a high-fidelity prototype into a production-ready, multi-tenant SaaS.

---

## 1. Security & Identity (Critical)
**Status: Complete**

- [x] **Revert Auth Bypass**: Restored real `authenticate_user()` with bcrypt password verification in `backend/app/api/routes/auth.py`. Login now validates credentials against DB, stores refresh tokens, and rejects invalid logins with 401.
- [x] **Tenant Isolation**: `TenantMiddleware` in `backend/app/middleware/tenant.py` sources `org_id` and `is_superadmin` from validated JWT claims. WebSocket dashboard auth restored with JWT validation via `decode_ws_token()`.
- [x] **Password Security**: `users` table uses `bcrypt` via `passlib` (confirmed in `services/auth.py`). Registration and password change both hash properly.
- [x] **CORS Hardening**: `cors_origins` in `core/config.py` is now configurable via `CORS_ORIGINS` env var (JSON list). Defaults to `localhost:3000/3001` for dev; production must set explicit domains.

## 2. Infrastructure & Deployment
**Status: Complete**

- [x] **Dockerization**:
    - [x] `backend/Dockerfile` — multi-stage Python 3.10-slim build.
    - [x] `frontend/Dockerfile` — multi-stage Node 18-alpine build.
- [x] **Cloud Hosting (Google Cloud Run)**:
    - [x] CI/CD pipeline configured to deploy to Cloud Run with WebSocket session affinity.
    - [x] `docker-compose.yml` — full-stack local dev (PostgreSQL + Redis + Backend + Frontend).
- [x] **CI/CD (GitHub Actions)**:
    - [x] `.github/workflows/ci.yml` — runs `ruff` lint + `pytest` (backend), `npm run lint` + `npm run build` (frontend).
    - [x] Auto-builds Docker images and deploys to Cloud Run on push to `main`.
- [x] **Secrets Management**: All credentials sourced from environment variables / `.env` files. Production uses Google Secret Manager via Cloud Run secret mounts. `.env.example` updated with all required keys.

## 3. High-Scale Features (Missing)
**Status: Complete**

- [x] **The "Campaign Autodialer"**:
    - [x] `backend/app/services/campaign_worker.py` — background worker that processes campaign lead lists with concurrency control (`MAX_CONCURRENT_CALLS=5`), rate-limit backoff, DNC checking, and graceful stop.
    - [x] `POST /api/v1/campaigns/{id}/start` — launches autodialer via FastAPI `BackgroundTasks`.
    - [x] `POST /api/v1/campaigns/{id}/stop` — graceful stop of running campaign.
    - [x] `GET /api/v1/campaigns/{id}/status` — check autodialer running state.
- [x] **Distributed State (Redis)**:
    - [x] `backend/app/services/redis.py` — async Redis client with sliding-window rate limiter.
    - [x] `outbound.py` rate limiting now uses Redis-backed counter (falls back to in-memory for single-instance).
    - [x] Redis service added to `docker-compose.yml` and wired into app lifespan.
- [x] **Recording Storage**: `recording.py` now includes `fetch_and_upload_twilio_recording()` which downloads completed recordings from Twilio and uploads to S3/R2. Twilio callback in `twilio.py` triggers this automatically with Twilio URL as fallback.

## 4. Compliance & Stability
**Status: Complete**

- [x] **DNC List Automation**:
    - [x] `POST /api/v1/settings/dnc/upload` — CSV upload endpoint. Auto-detects phone column, normalises numbers, de-duplicates, and merges with existing DNC list.
    - [x] `GET /api/v1/settings/dnc` — view current DNC list.
    - [x] `DELETE /api/v1/settings/dnc` — clear DNC list.
- [x] **Global Error Tracking**:
    - [x] Backend: Sentry SDK integrated in `app/main.py` with `sentry-sdk[fastapi]`. Configurable via `SENTRY_DSN` env var.
    - [x] Frontend: Lazy-loaded Sentry init via `sentry-init.tsx` component. Configurable via `NEXT_PUBLIC_SENTRY_DSN`.
- [x] **Alembic Migrations**: Full Alembic setup with async engine support. Initial migration (`001_initial_schema.py`) covers all 25+ tables with indexes and pgvector extension. `env.py` auto-discovers models and reads `DATABASE_URL` from settings.

## 5. Frontend Polish
**Status: Complete (Pre-existing)**

- [x] **Real-world API URLs**: `api-client.ts` uses `NEXT_PUBLIC_API_URL` env var. `next.config.mjs` proxies `/api/v1/*` and `/ws/*` to backend via `BACKEND_URL` env var.
- [x] **SaaS Onboarding**: 5-step onboarding wizard at `/onboarding` — company details, insurance focus, voice agent setup, phone provisioning, review & launch.
- [x] **User Role Management**: Settings page includes Team Management tab with invite, role assignment (admin/manager/agent/viewer), and member removal.

---

## Technical Stack (Production)
*   **Frontend**: Next.js 14 (Vercel or Cloud Run)
*   **Backend**: FastAPI (Google Cloud Run Containers)
*   **Database**: Supabase PostgreSQL + pgvector
*   **Caching/Queues**: Redis (docker-compose local, Upstash/Memorystore production)
*   **Voice Engine**: Twilio + OpenAI Realtime API (GPT-4o)
*   **Error Tracking**: Sentry (backend + frontend)
*   **CI/CD**: GitHub Actions → Google Cloud Run
*   **Storage**: S3/R2 for call recordings
