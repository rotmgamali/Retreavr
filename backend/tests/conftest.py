"""
Test configuration for Retrevr Insurance Platform backend.

Tests use a real PostgreSQL database when available (TEST_DATABASE_URL env var),
or skip if no database connection can be established.

To run tests with a local database:
    TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/retrevr_test pytest
"""
import os
import uuid
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.api.deps import get_db
from app.core.database import Base
from app.models.organization import Organization
from app.models.user import User
from app.services.auth import hash_password, create_access_token

# ── Database URL ──────────────────────────────────────────────────────────────
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/retrevr_test",
)

# ── Engine + session factory ──────────────────────────────────────────────────
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


# ── Database availability check ───────────────────────────────────────────────
async def _check_db_available() -> bool:
    try:
        async with test_engine.connect() as conn:
            await conn.run_sync(lambda c: c.execute(__import__("sqlalchemy").text("SELECT 1")))
        return True
    except Exception:
        return False


# ── Session-scoped fixtures ───────────────────────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_available():
    """Skip entire session if database is not reachable."""
    available = await _check_db_available()
    if not available:
        pytest.skip(
            "No PostgreSQL database available. "
            "Set TEST_DATABASE_URL or start Docker: docker-compose up -d"
        )
    return True


@pytest_asyncio.fixture(scope="session")
async def setup_database(db_available):
    """Create all tables once per test session, drop after."""
    async with test_engine.begin() as conn:
        # Enable pgvector
        await conn.execute(__import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


# ── Function-scoped db session with rollback ─────────────────────────────────
@pytest_asyncio.fixture
async def db_session(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional session rolled back after each test."""
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


# ── FastAPI test client ───────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient wired to a rolled-back test session."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Seed fixtures ─────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def test_org(db_session: AsyncSession) -> Organization:
    org = Organization(
        name="Test Insurance Co",
        slug=f"test-ins-{uuid.uuid4().hex[:8]}",
        subscription_tier="starter",
    )
    db_session.add(org)
    await db_session.flush()
    await db_session.refresh(org)
    return org


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_org: Organization) -> User:
    user = User(
        organization_id=test_org.id,
        email=f"agent-{uuid.uuid4().hex[:6]}@example.com",
        hashed_password=hash_password("password123"),
        first_name="Test",
        last_name="Agent",
        role="admin",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def auth_headers(test_user: User, test_org: Organization) -> dict:
    token = create_access_token(test_user.id, test_org.id, test_user.role)
    return {"Authorization": f"Bearer {token}"}
