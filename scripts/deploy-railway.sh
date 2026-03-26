#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# Retrevr Insurance Platform — Railway Deployment Script
#
# Prerequisites:
#   1. Railway CLI installed:  npm install -g @railway/cli
#   2. Logged in:              railway login
#   3. Git repo pushed to GitHub (Railway pulls from your repo)
#
# Usage:
#   chmod +x scripts/deploy-railway.sh
#   ./scripts/deploy-railway.sh
#
# What this does:
#   - Creates a Railway project
#   - Creates backend + frontend services
#   - Sets all environment variables from your .env files
#   - Links to your GitHub repo for auto-deploy on git push
# ──────────────────────────────────────────────────────────────────────────────

RAILWAY=${RAILWAY_CLI:-railway}

# Check CLI
if ! command -v "$RAILWAY" &>/dev/null; then
  echo "❌ Railway CLI not found. Install with: npm install -g @railway/cli"
  exit 1
fi

# Check auth
if ! "$RAILWAY" whoami &>/dev/null; then
  echo "❌ Not logged in. Run: railway login"
  exit 1
fi

echo "🚀 Creating Railway project: retrevr-insurance"
"$RAILWAY" init --name retrevr-insurance 2>/dev/null || echo "   (project may already exist)"

# ── Backend Service ──────────────────────────────────────────────────────────

echo ""
echo "📦 Creating backend service..."
"$RAILWAY" service create backend 2>/dev/null || echo "   (service may already exist)"
"$RAILWAY" link --service backend

# Set root directory
"$RAILWAY" variables set RAILWAY_DOCKERFILE_PATH=Dockerfile
"$RAILWAY" variables set RAILWAY_ROOT_DIRECTORY=backend

# Load backend env vars
if [ -f "backend/.env" ]; then
  echo "   Loading backend environment variables..."
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    # Skip if value is empty
    [[ -z "$value" ]] && continue
    "$RAILWAY" variables set "$key=$value" 2>/dev/null
    echo "   ✓ $key"
  done < "backend/.env"
fi

# Override for production
"$RAILWAY" variables set DEBUG=false
"$RAILWAY" variables set PORT=8000

echo "   ✅ Backend service configured"

# ── Frontend Service ─────────────────────────────────────────────────────────

echo ""
echo "🎨 Creating frontend service..."
"$RAILWAY" service create frontend 2>/dev/null || echo "   (service may already exist)"
"$RAILWAY" link --service frontend

# Set root directory
"$RAILWAY" variables set RAILWAY_DOCKERFILE_PATH=Dockerfile
"$RAILWAY" variables set RAILWAY_ROOT_DIRECTORY=frontend
"$RAILWAY" variables set NEXT_PUBLIC_API_URL=/api/v1

# Load frontend env vars
if [ -f "frontend/.env.local" ]; then
  echo "   Loading frontend environment variables..."
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    [[ -z "$value" ]] && continue
    "$RAILWAY" variables set "$key=$value" 2>/dev/null
    echo "   ✓ $key"
  done < "frontend/.env.local"
fi

"$RAILWAY" variables set PORT=3000

echo "   ✅ Frontend service configured"

# ── Post-Deploy Instructions ─────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ Railway project created with backend + frontend services"
echo ""
echo "  NEXT STEPS (one-time, in Railway dashboard):"
echo ""
echo "  1. Go to https://railway.app → your 'retrevr-insurance' project"
echo ""
echo "  2. For EACH service (backend & frontend):"
echo "     → Settings → Source → Connect GitHub repo"
echo "     → Select 'rotmgamali/Retreavr'"
echo "     → Set Root Directory: 'backend/' or 'frontend/'"
echo ""
echo "  3. Generate domains:"
echo "     → backend service → Settings → Networking → Generate Domain"
echo "     → frontend service → Settings → Networking → Generate Domain"
echo ""
echo "  4. Update cross-references (Variables tab):"
echo "     → Backend: CORS_ORIGINS=[\"https://YOUR-FRONTEND.railway.app\"]"
echo "     → Backend: TWILIO_WEBHOOK_BASE_URL=https://YOUR-BACKEND.railway.app"
echo "     → Frontend: BACKEND_URL=https://YOUR-BACKEND.railway.app"
echo ""
echo "  5. Redeploy both services"
echo ""
echo "  After this, every 'git push' auto-deploys both services."
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  🔑 App login: admin@retrevr.io / demo123!"
echo ""
