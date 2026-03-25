"""Tests for /api/v1/leads CRUD endpoints."""
import uuid
import pytest
from httpx import AsyncClient

from app.models.organization import Organization
from app.models.leads import Lead
from sqlalchemy.ext.asyncio import AsyncSession


PREFIX = "/api/v1/leads"


async def _create_lead(client: AsyncClient, auth_headers: dict, **overrides) -> dict:
    payload = {
        "first_name": "John",
        "last_name": "Doe",
        "email": f"lead-{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+15551234567",
        "insurance_type": "auto",
        "status": "new",
    }
    payload.update(overrides)
    resp = await client.post(f"{PREFIX}/", headers=auth_headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_lead(client: AsyncClient, auth_headers: dict):
    data = await _create_lead(client, auth_headers)
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["insurance_type"] == "auto"
    assert data["status"] == "new"
    assert data["is_deleted"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_list_leads(client: AsyncClient, auth_headers: dict):
    await _create_lead(client, auth_headers)
    await _create_lead(client, auth_headers)

    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2


@pytest.mark.asyncio
async def test_list_leads_pagination(client: AsyncClient, auth_headers: dict):
    for _ in range(3):
        await _create_lead(client, auth_headers)

    resp = await client.get(f"{PREFIX}/?limit=2&offset=0", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 2
    assert data["total"] >= 3


@pytest.mark.asyncio
async def test_get_lead(client: AsyncClient, auth_headers: dict):
    lead = await _create_lead(client, auth_headers)
    resp = await client.get(f"{PREFIX}/{lead['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == lead["id"]


@pytest.mark.asyncio
async def test_get_lead_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_lead(client: AsyncClient, auth_headers: dict):
    lead = await _create_lead(client, auth_headers)
    resp = await client.patch(f"{PREFIX}/{lead['id']}", headers=auth_headers, json={
        "status": "qualified",
        "propensity_score": 0.85,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "qualified"
    assert data["propensity_score"] == pytest.approx(0.85)


@pytest.mark.asyncio
async def test_update_lead_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers, json={
        "status": "qualified",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_lead(client: AsyncClient, auth_headers: dict):
    lead = await _create_lead(client, auth_headers)
    resp = await client.delete(f"{PREFIX}/{lead['id']}", headers=auth_headers)
    assert resp.status_code == 204

    # Soft-deleted leads are not returned
    resp2 = await client.get(f"{PREFIX}/{lead['id']}", headers=auth_headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_deleted_lead_excluded_from_list(client: AsyncClient, auth_headers: dict):
    lead = await _create_lead(client, auth_headers)
    await client.delete(f"{PREFIX}/{lead['id']}", headers=auth_headers)

    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    ids = [item["id"] for item in resp.json()["items"]]
    assert lead["id"] not in ids


@pytest.mark.asyncio
async def test_create_lead_interaction(client: AsyncClient, auth_headers: dict):
    lead = await _create_lead(client, auth_headers)
    resp = await client.post(f"{PREFIX}/{lead['id']}/interactions", headers=auth_headers, json={
        "interaction_type": "call",
        "notes": "Left voicemail",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["interaction_type"] == "call"
    assert data["lead_id"] == lead["id"]


@pytest.mark.asyncio
async def test_list_lead_interactions(client: AsyncClient, auth_headers: dict):
    lead = await _create_lead(client, auth_headers)
    for t in ["call", "email", "sms"]:
        await client.post(f"{PREFIX}/{lead['id']}/interactions", headers=auth_headers, json={
            "interaction_type": t,
        })

    resp = await client.get(f"{PREFIX}/{lead['id']}/interactions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    resp = await client.get(f"{PREFIX}/")
    assert resp.status_code == 401
