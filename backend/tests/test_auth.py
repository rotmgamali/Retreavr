"""
Auth flow, tenant isolation, and RBAC test suite.

[RET-42] Covers:
1. Service unit tests  – password hashing, JWT creation/validation, token utils
2. API endpoint tests  – register, login, refresh token rotation, logout, /me
3. Tenant isolation    – two orgs; JWT embeds correct org_id; cross-tenant blocked
4. RBAC enforcement    – require_role dependency; has_role / assert_role / assert_same_org

DB tests require PostgreSQL (see conftest.py – skipped automatically when DB unavailable).
Unit tests always run.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from jose import JWTError, jwt

from app.api.deps import get_current_active_user, require_role
from app.core.config import get_settings
from app.middleware.rbac import assert_role, assert_same_org, has_role
from app.models.organization import Organization
from app.models.user import ROLE_HIERARCHY, User, UserRole
from app.services.auth import (
    create_access_token,
    create_refresh_token_value,
    hash_password,
    validate_access_token,
    verify_password,
)

settings = get_settings()
PREFIX = "/api/v1/auth"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user_obj(role: str = "agent", org_id: uuid.UUID | None = None) -> SimpleNamespace:
    """Create a plain namespace mimicking a User for unit tests (no DB/ORM needed)."""
    return SimpleNamespace(
        id=uuid.uuid4(),
        organization_id=org_id or uuid.uuid4(),
        role=role,
        email=f"{role}-{uuid.uuid4().hex[:4]}@test.com",
        first_name=role.capitalize(),
        last_name="User",
        is_active=True,
    )


# ---------------------------------------------------------------------------
# Part 1 – Service unit tests (no DB, no HTTP required)
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    def test_hash_round_trip(self):
        pw = "s3cur3P@ss!"
        assert verify_password(pw, hash_password(pw))

    def test_wrong_password_rejected(self):
        assert not verify_password("wrong", hash_password("correct"))

    def test_hashes_are_distinct_due_to_salt(self):
        pw = "same"
        assert hash_password(pw) != hash_password(pw)  # bcrypt uses a random salt

    def test_hash_is_not_plaintext(self):
        pw = "supersecret"
        assert hash_password(pw) != pw


class TestJWT:
    def test_access_token_payload_structure(self):
        user_id = uuid.uuid4()
        org_id = uuid.uuid4()
        token = create_access_token(user_id, org_id, "manager")
        payload = validate_access_token(token)

        assert payload["sub"] == str(user_id)
        assert payload["org_id"] == str(org_id)
        assert payload["role"] == "manager"
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_validate_rejects_non_access_type(self):
        expire = datetime.now(timezone.utc) + timedelta(minutes=5)
        bad = jwt.encode(
            {"sub": "x", "org_id": "y", "role": "agent", "type": "refresh", "exp": expire},
            settings.secret_key,
            algorithm=settings.algorithm,
        )
        with pytest.raises(JWTError):
            validate_access_token(bad)

    def test_validate_rejects_tampered_signature(self):
        token = create_access_token(uuid.uuid4(), uuid.uuid4(), "agent")
        tampered = token[:-6] + "XXXXXX"
        with pytest.raises(JWTError):
            validate_access_token(tampered)

    def test_validate_rejects_expired_token(self):
        expired = datetime.now(timezone.utc) - timedelta(seconds=1)
        token = jwt.encode(
            {"sub": "x", "org_id": "y", "type": "access", "exp": expired},
            settings.secret_key,
            algorithm=settings.algorithm,
        )
        with pytest.raises(JWTError):
            validate_access_token(token)

    def test_refresh_token_value_is_valid_uuid(self):
        value = create_refresh_token_value()
        uuid.UUID(value)  # raises ValueError if not a valid UUID

    def test_different_orgs_produce_distinct_tokens(self):
        uid = uuid.uuid4()
        t1 = create_access_token(uid, uuid.uuid4(), "agent")
        t2 = create_access_token(uid, uuid.uuid4(), "agent")
        assert t1 != t2


class TestRBACHelpers:
    def test_has_role_hierarchy(self):
        admin = _make_user_obj("admin")
        assert has_role(admin, UserRole.viewer)
        assert has_role(admin, UserRole.agent)
        assert has_role(admin, UserRole.manager)
        assert has_role(admin, UserRole.admin)
        assert not has_role(admin, UserRole.superadmin)

    def test_viewer_only_meets_viewer_requirement(self):
        viewer = _make_user_obj("viewer")
        assert has_role(viewer, UserRole.viewer)
        assert not has_role(viewer, UserRole.agent)

    def test_assert_role_raises_403_when_insufficient(self):
        from fastapi import HTTPException

        viewer = _make_user_obj("viewer")
        with pytest.raises(HTTPException) as exc:
            assert_role(viewer, UserRole.admin)
        assert exc.value.status_code == 403

    def test_assert_role_passes_when_sufficient(self):
        admin = _make_user_obj("admin")
        assert_role(admin, UserRole.admin)  # must not raise

    def test_assert_same_org_blocks_cross_tenant(self):
        from fastapi import HTTPException

        org_a, org_b = uuid.uuid4(), uuid.uuid4()
        user = _make_user_obj("agent", org_id=org_a)
        with pytest.raises(HTTPException) as exc:
            assert_same_org(user, org_b)
        assert exc.value.status_code == 403

    def test_assert_same_org_allows_same_tenant(self):
        org_id = uuid.uuid4()
        user = _make_user_obj("agent", org_id=org_id)
        assert_same_org(user, org_id)  # must not raise

    def test_superadmin_bypasses_org_check(self):
        org_a, org_b = uuid.uuid4(), uuid.uuid4()
        superadmin = _make_user_obj("superadmin", org_id=org_a)
        assert_same_org(superadmin, org_b)  # must not raise

    def test_role_hierarchy_ordering(self):
        assert ROLE_HIERARCHY[UserRole.superadmin] > ROLE_HIERARCHY[UserRole.admin]
        assert ROLE_HIERARCHY[UserRole.admin] > ROLE_HIERARCHY[UserRole.manager]
        assert ROLE_HIERARCHY[UserRole.manager] > ROLE_HIERARCHY[UserRole.agent]
        assert ROLE_HIERARCHY[UserRole.agent] > ROLE_HIERARCHY[UserRole.viewer]


# ---------------------------------------------------------------------------
# Part 2 – Register endpoint
# ---------------------------------------------------------------------------


class TestRegisterEndpoint:
    async def test_register_success(self, client: AsyncClient, test_org: Organization):
        resp = await client.post(
            f"{PREFIX}/register",
            json={
                "email": f"new-{uuid.uuid4().hex[:6]}@example.com",
                "password": "securepass",
                "first_name": "Alice",
                "last_name": "Smith",
                "organization_id": str(test_org.id),
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["organization_id"] == str(test_org.id)
        assert data["role"] == "agent"
        assert data["is_active"] is True
        assert "id" in data
        assert "hashed_password" not in data

    async def test_register_duplicate_email_returns_409(
        self, client: AsyncClient, test_org: Organization, test_user: User
    ):
        resp = await client.post(
            f"{PREFIX}/register",
            json={
                "email": test_user.email,
                "password": "securepass",
                "first_name": "Dup",
                "last_name": "User",
                "organization_id": str(test_org.id),
            },
        )
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    async def test_register_unknown_org_returns_400(self, client: AsyncClient):
        resp = await client.post(
            f"{PREFIX}/register",
            json={
                "email": f"x-{uuid.uuid4().hex}@example.com",
                "password": "securepass",
                "first_name": "X",
                "last_name": "Y",
                "organization_id": str(uuid.uuid4()),
            },
        )
        assert resp.status_code == 400
        assert "organization not found" in resp.json()["detail"].lower()

    async def test_register_missing_required_fields_returns_422(
        self, client: AsyncClient, test_org: Organization
    ):
        resp = await client.post(
            f"{PREFIX}/register",
            json={"email": "incomplete@example.com", "organization_id": str(test_org.id)},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Part 3 – Login endpoint
# ---------------------------------------------------------------------------


class TestLoginEndpoint:
    async def test_login_success_returns_both_tokens(self, client: AsyncClient, test_user: User):
        resp = await client.post(
            f"{PREFIX}/login",
            json={"email": test_user.email, "password": "password123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_access_token_carries_correct_claims(
        self, client: AsyncClient, test_user: User
    ):
        resp = await client.post(
            f"{PREFIX}/login",
            json={"email": test_user.email, "password": "password123"},
        )
        payload = validate_access_token(resp.json()["access_token"])
        assert payload["sub"] == str(test_user.id)
        assert payload["org_id"] == str(test_user.organization_id)
        assert payload["role"] == test_user.role
        assert payload["type"] == "access"

    async def test_login_wrong_password_returns_401(self, client: AsyncClient, test_user: User):
        resp = await client.post(
            f"{PREFIX}/login",
            json={"email": test_user.email, "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    async def test_login_unknown_user_returns_401(self, client: AsyncClient):
        resp = await client.post(
            f"{PREFIX}/login",
            json={"email": "nobody@example.com", "password": "password123"},
        )
        assert resp.status_code == 401

    async def test_login_inactive_user_returns_403(
        self, client: AsyncClient, db_session, test_org: Organization
    ):
        inactive = User(
            organization_id=test_org.id,
            email=f"inactive-{uuid.uuid4().hex[:6]}@example.com",
            hashed_password=hash_password("password123"),
            first_name="In",
            last_name="Active",
            role="agent",
            is_active=False,
        )
        db_session.add(inactive)
        await db_session.flush()
        await db_session.refresh(inactive)

        resp = await client.post(
            f"{PREFIX}/login",
            json={"email": inactive.email, "password": "password123"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Part 4 – Refresh token rotation
# ---------------------------------------------------------------------------


class TestRefreshEndpoint:
    async def test_refresh_returns_new_access_token(self, client: AsyncClient, test_user: User):
        login = await client.post(
            f"{PREFIX}/login",
            json={"email": test_user.email, "password": "password123"},
        )
        original_access = login.json()["access_token"]
        refresh_token = login.json()["refresh_token"]

        resp = await client.post(f"{PREFIX}/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        new_token = resp.json()["access_token"]
        assert new_token != original_access

        # New token must carry same identity
        payload = validate_access_token(new_token)
        assert payload["sub"] == str(test_user.id)

    async def test_refresh_token_rotation_revokes_old_token(
        self, client: AsyncClient, test_user: User
    ):
        """After a successful refresh the same refresh token must be rejected."""
        login = await client.post(
            f"{PREFIX}/login",
            json={"email": test_user.email, "password": "password123"},
        )
        refresh_token = login.json()["refresh_token"]

        first = await client.post(f"{PREFIX}/refresh", json={"refresh_token": refresh_token})
        assert first.status_code == 200

        # Replay the same token — must fail (rotation enforces single-use)
        second = await client.post(f"{PREFIX}/refresh", json={"refresh_token": refresh_token})
        assert second.status_code == 401

    async def test_refresh_unknown_token_returns_401(self, client: AsyncClient):
        resp = await client.post(
            f"{PREFIX}/refresh", json={"refresh_token": str(uuid.uuid4())}
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Part 5 – Logout endpoint
# ---------------------------------------------------------------------------


class TestLogoutEndpoint:
    async def test_logout_revokes_refresh_token(self, client: AsyncClient, test_user: User):
        login = await client.post(
            f"{PREFIX}/login",
            json={"email": test_user.email, "password": "password123"},
        )
        access_token = login.json()["access_token"]
        refresh_token = login.json()["refresh_token"]

        logout = await client.post(
            f"{PREFIX}/logout",
            json={"refresh_token": refresh_token},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert logout.status_code == 204

        after = await client.post(f"{PREFIX}/refresh", json={"refresh_token": refresh_token})
        assert after.status_code == 401  # token was revoked on logout

    async def test_logout_without_auth_header_returns_401(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/logout", json={"refresh_token": str(uuid.uuid4())})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Part 6 – /me endpoint
# ---------------------------------------------------------------------------


class TestMeEndpoint:
    async def test_get_me_returns_own_profile(
        self, client: AsyncClient, auth_headers: dict, test_user: User
    ):
        resp = await client.get(f"{PREFIX}/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == test_user.email
        assert data["id"] == str(test_user.id)
        assert data["organization_id"] == str(test_user.organization_id)

    async def test_get_me_without_token_returns_401(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/me")
        assert resp.status_code == 401

    async def test_get_me_invalid_token_returns_401(self, client: AsyncClient):
        resp = await client.get(
            f"{PREFIX}/me", headers={"Authorization": "Bearer bad.token.here"}
        )
        assert resp.status_code == 401

    async def test_update_me_changes_first_name(self, client: AsyncClient, auth_headers: dict):
        resp = await client.patch(
            f"{PREFIX}/me", headers=auth_headers, json={"first_name": "Updated"}
        )
        assert resp.status_code == 200
        assert resp.json()["first_name"] == "Updated"

    async def test_full_flow_register_login_me(
        self, client: AsyncClient, test_org: Organization
    ):
        """End-to-end: register → login → /me returns the registered profile."""
        email = f"flow-{uuid.uuid4().hex[:6]}@example.com"

        reg = await client.post(
            f"{PREFIX}/register",
            json={
                "email": email,
                "password": "password123",
                "first_name": "Flow",
                "last_name": "Test",
                "organization_id": str(test_org.id),
            },
        )
        assert reg.status_code == 201

        login = await client.post(
            f"{PREFIX}/login", json={"email": email, "password": "password123"}
        )
        assert login.status_code == 200

        me = await client.get(
            f"{PREFIX}/me",
            headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["email"] == email


# ---------------------------------------------------------------------------
# Part 7 – Tenant isolation
# ---------------------------------------------------------------------------


class TestTenantIsolation:
    async def _seed_org_and_user(
        self, db_session, tag: str
    ) -> tuple[Organization, User]:
        org = Organization(
            name=f"Org {tag}",
            slug=f"org-{uuid.uuid4().hex[:8]}",
            subscription_tier="starter",
        )
        db_session.add(org)
        await db_session.flush()
        await db_session.refresh(org)

        user = User(
            organization_id=org.id,
            email=f"user-{uuid.uuid4().hex[:6]}@{tag}.example.com",
            hashed_password=hash_password("password123"),
            first_name="User",
            last_name=tag,
            role="admin",
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        return org, user

    async def test_jwt_carries_correct_org_id(self, client: AsyncClient, db_session):
        org, user = await self._seed_org_and_user(db_session, "alpha")
        resp = await client.post(
            f"{PREFIX}/login", json={"email": user.email, "password": "password123"}
        )
        payload = validate_access_token(resp.json()["access_token"])
        assert payload["org_id"] == str(org.id)
        assert payload["sub"] == str(user.id)

    async def test_two_orgs_produce_distinct_org_ids_in_tokens(
        self, client: AsyncClient, db_session
    ):
        org_a, user_a = await self._seed_org_and_user(db_session, "delta")
        org_b, user_b = await self._seed_org_and_user(db_session, "echo")

        resp_a = await client.post(
            f"{PREFIX}/login", json={"email": user_a.email, "password": "password123"}
        )
        resp_b = await client.post(
            f"{PREFIX}/login", json={"email": user_b.email, "password": "password123"}
        )

        p_a = validate_access_token(resp_a.json()["access_token"])
        p_b = validate_access_token(resp_b.json()["access_token"])

        assert p_a["org_id"] == str(org_a.id)
        assert p_b["org_id"] == str(org_b.id)
        assert p_a["org_id"] != p_b["org_id"]  # data isolation: different orgs, different tokens

    async def test_me_returns_only_own_org_profile(self, client: AsyncClient, db_session):
        org_a, user_a = await self._seed_org_and_user(db_session, "foxtrot")
        _, user_b = await self._seed_org_and_user(db_session, "golf")

        token_a = create_access_token(user_a.id, org_a.id, user_a.role)
        resp = await client.get(
            f"{PREFIX}/me", headers={"Authorization": f"Bearer {token_a}"}
        )
        assert resp.status_code == 200
        assert resp.json()["organization_id"] == str(org_a.id)
        assert resp.json()["id"] != str(user_b.id)  # can't see other org's user

    def test_assert_same_org_blocks_cross_tenant_resource_access(self):
        from fastapi import HTTPException

        org_a, org_b = uuid.uuid4(), uuid.uuid4()
        user = _make_user_obj("agent", org_id=org_a)
        with pytest.raises(HTTPException) as exc:
            assert_same_org(user, org_b)
        assert exc.value.status_code == 403

    def test_superadmin_can_access_any_org(self):
        org_a, org_b = uuid.uuid4(), uuid.uuid4()
        superadmin = _make_user_obj("superadmin", org_id=org_a)
        assert_same_org(superadmin, org_b)  # must not raise


# ---------------------------------------------------------------------------
# Part 8 – RBAC enforcement via require_role dependency
# ---------------------------------------------------------------------------


@pytest.fixture
def rbac_app():
    """Minimal FastAPI app with role-protected routes for RBAC testing."""
    app = FastAPI()

    @app.get("/admin-only")
    async def admin_only(user=Depends(require_role(["admin", "superadmin"]))):
        return {"role": user.role}

    @app.get("/manager-up")
    async def manager_up(user=Depends(require_role(["manager", "admin", "superadmin"]))):
        return {"role": user.role}

    @app.get("/viewer-up")
    async def viewer_up(
        user=Depends(
            require_role(["viewer", "agent", "manager", "admin", "superadmin"])
        )
    ):
        return {"role": user.role}

    return app


def _inject_role(app: FastAPI, role: str) -> User:
    """Override get_current_active_user to inject a user with the given role."""
    user = _make_user_obj(role)

    async def _override():
        return user

    app.dependency_overrides[get_current_active_user] = _override
    return user


@pytest_asyncio.fixture
async def rbac_client(rbac_app: FastAPI):
    async with AsyncClient(transport=ASGITransport(app=rbac_app), base_url="http://test") as ac:
        yield ac
    rbac_app.dependency_overrides.clear()


class TestRequireRoleDependency:
    async def test_admin_accesses_admin_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "admin")
        resp = await rbac_client.get("/admin-only")
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    async def test_superadmin_accesses_admin_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "superadmin")
        resp = await rbac_client.get("/admin-only")
        assert resp.status_code == 200

    async def test_manager_blocked_from_admin_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "manager")
        resp = await rbac_client.get("/admin-only")
        assert resp.status_code == 403

    async def test_viewer_blocked_from_admin_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "viewer")
        resp = await rbac_client.get("/admin-only")
        assert resp.status_code == 403

    async def test_manager_accesses_manager_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "manager")
        resp = await rbac_client.get("/manager-up")
        assert resp.status_code == 200

    async def test_agent_blocked_from_manager_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "agent")
        resp = await rbac_client.get("/manager-up")
        assert resp.status_code == 403

    async def test_viewer_blocked_from_manager_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "viewer")
        resp = await rbac_client.get("/manager-up")
        assert resp.status_code == 403

    async def test_viewer_accesses_viewer_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "viewer")
        resp = await rbac_client.get("/viewer-up")
        assert resp.status_code == 200

    async def test_agent_accesses_viewer_endpoint(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "agent")
        resp = await rbac_client.get("/viewer-up")
        assert resp.status_code == 200

    async def test_admin_accesses_all_levels(self, rbac_app, rbac_client):
        _inject_role(rbac_app, "admin")
        for path in ("/admin-only", "/manager-up", "/viewer-up"):
            resp = await rbac_client.get(path)
            assert resp.status_code == 200, f"admin should access {path}"
