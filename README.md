# Retrevr Insurance Platform (SaaS)

A high-performance, multi-tenant AI Voice Agent platform for the insurance industry. Built with FastAPI, Next.js, and OpenAI Realtime API.

---

## 🛠 Tech Stack
- **Backend**: FastAPI (Python 3.10)
- **Frontend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Voice**: Twilio + OpenAI Realtime (Mu-law stream)

---

## 🚀 Production Deployment

### 1. Backend (Google Cloud Run)
The backend is Dockerized and ready for Google Cloud Run (recommended for reliable WebSockets).

**Build and Push:**
```bash
docker build -t gcr.io/[PROJECT_ID]/retrevr-backend ./backend
docker push gcr.io/[PROJECT_ID]/retrevr-backend
```

**Deploy:**
```bash
gcloud run deploy retrevr-backend \
  --image gcr.io/[PROJECT_ID]/retrevr-backend \
  --set-env-vars DATABASE_URL="[DB_URL]",OPENAI_API_KEY="[KEY]" \
  --allow-unauthenticated \
  --port 8000
```

### 2. Frontend (Vercel)
The frontend is optimized for Vercel.

1. Connect your GitHub repository to Vercel.
2. Set the **Root Directory** to `frontend`.
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your deployed backend URL (e.g., `https://api.retrevr.io/api/v1`).

---

## 🔐 Security & Multi-Tenancy
- **JWT Auth**: Full access and refresh token rotation.
- **Org Isolation**: Every request is scoped to an `organization_id` via `TenantMiddleware`.
- **DNC Protection**: Automatic Do-Not-Call list checks for all outbound sessions.

---

## 📈 Roadmap (HYPERSCALE)
See the [HYPERSCALE.md](./HYPERSCALE.md) file for the full production transition plan, including autodialer implementation and Redis scaling.
