"""Tests for /api/v1/organizations CRUD endpoints."""
import uuid
import pytest
from httpx import AsyncClient

from app.models.organization import Organization


PREFIX = "/api/v1/organizations"


@pytest.mark.asyncio
async def test_list_organizations(client: AsyncClient, auth_headers: dict, test_org: Organization):
    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    ids = [item["id"] for item in data["items"]]
    assert str(test_org.id) in ids


@pytest.mark.asyncio
async def test_list_organizations_pagination(client: AsyncClient, auth_headers: dict, test_org: Organization):
    resp = await client.get(f"{PREFIX}/?limit=1&offset=0", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 1


@pytest.mark.asyncio
async def test_get_organization(client: AsyncClient, auth_headers: dict, test_org: Organization):
    resp = await client.get(f"{PREFIX}/{test_org.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(test_org.id)
    assert data["name"] == test_org.name
    assert data["slug"] == test_org.slug


@pytest.mark.asyncio
async def test_get_organization_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_organization(client: AsyncClient, auth_headers: dict):
    slug = f"new-org-{uuid.uuid4().hex[:8]}"
    resp = await client.post(f"{PREFIX}/", headers=auth_headers, json={
        "name": "New Test Org",
        "slug": slug,
        "subscription_tier": "professional",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == slug
    assert data["name"] == "New Test Org"
    assert data["subscription_tier"] == "professional"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_update_organization(client: AsyncClient, auth_headers: dict, test_org: Organization):
    resp = await client.patch(f"{PREFIX}/{test_org.id}", headers=auth_headers, json={
        "name": "Updated Name",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"
    assert resp.json()["id"] == str(test_org.id)


@pytest.mark.asyncio
async def test_update_organization_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers, json={
        "name": "Ghost",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_organization(client: AsyncClient, auth_headers: dict):
    # Create a fresh org to delete
    slug = f"del-org-{uuid.uuid4().hex[:8]}"
    create_resp = await client.post(f"{PREFIX}/", headers=auth_headers, json={
        "name": "To Delete",
        "slug": slug,
    })
    org_id = create_resp.json()["id"]

    resp = await client.delete(f"{PREFIX}/{org_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Should still be retrievable but is_active=False
    get_resp = await client.get(f"{PREFIX}/{org_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] is False


@pytest.mark.asyncio
async def test_delete_organization_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    resp = await client.get(f"{PREFIX}/")
    assert resp.status_code == 401
