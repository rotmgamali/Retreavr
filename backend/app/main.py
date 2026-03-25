from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.middleware.tenant import TenantMiddleware
from app.api.routes.auth import router as auth_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.realtime.event_bus import event_bus
    from app.services.realtime.connection_manager import connection_manager
    from app.services.realtime.notifications import notification_dispatcher

    await event_bus.start()
    connection_manager.register_with_event_bus()
    notification_dispatcher.register()

    yield

    await event_bus.stop()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url=f"{settings.api_prefix}/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TenantMiddleware)

app.include_router(auth_router, prefix=settings.api_prefix)

from app.api.routes.knowledge import router as knowledge_router  # noqa: E402
from app.api.routes.organizations import router as organizations_router  # noqa: E402
from app.api.routes.voice_agents import router as voice_agents_router  # noqa: E402
from app.api.routes.leads import router as leads_router  # noqa: E402
from app.api.routes.calls import router as calls_router  # noqa: E402
from app.api.routes.campaigns import router as campaigns_router  # noqa: E402
from app.api.routes.analytics import router as analytics_router  # noqa: E402
from app.api.routes.settings import router as settings_router  # noqa: E402

app.include_router(knowledge_router, prefix=settings.api_prefix)
app.include_router(organizations_router, prefix=settings.api_prefix)
app.include_router(voice_agents_router, prefix=settings.api_prefix)
app.include_router(leads_router, prefix=settings.api_prefix)
app.include_router(calls_router, prefix=settings.api_prefix)
app.include_router(campaigns_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(settings_router, prefix=settings.api_prefix)

# WebSocket routes (no API prefix — WS clients connect directly)
from app.api.routes.ws_calls import router as ws_calls_router
from app.api.routes.ws_dashboard import router as ws_dashboard_router

app.include_router(ws_calls_router)
app.include_router(ws_dashboard_router)

# Twilio webhooks — no api_prefix, validated via Twilio request signatures (not JWT)
from app.api.routes.twilio import router as twilio_router  # noqa: E402

app.include_router(twilio_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}
