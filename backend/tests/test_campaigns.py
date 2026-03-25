"""Tests for /api/v1/campaigns CRUD endpoints."""
import uuid
import pytest
from httpx import AsyncClient


PREFIX = "/api/v1/campaigns"


async def _create_campaign(client: AsyncClient, auth_headers: dict, **overrides) -> dict:
    payload = {
        "name": f"Campaign-{uuid.uuid4().hex[:6]}",
        "type": "outbound_call",
        "status": "draft",
        "config": {"max_calls_per_day": 100},
    }
    payload.update(overrides)
    resp = await client.post(f"{PREFIX}/", headers=auth_headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_campaign(client: AsyncClient, auth_headers: dict):
    data = await _create_campaign(client, auth_headers)
    assert data["type"] == "outbound_call"
    assert data["status"] == "draft"
    assert data["is_deleted"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_list_campaigns(client: AsyncClient, auth_headers: dict):
    await _create_campaign(client, auth_headers)
    await _create_campaign(client, auth_headers)

    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2


@pytest.mark.asyncio
async def test_get_campaign(client: AsyncClient, auth_headers: dict):
    campaign = await _create_campaign(client, auth_headers)
    resp = await client.get(f"{PREFIX}/{campaign['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == campaign["id"]


@pytest.mark.asyncio
async def test_get_campaign_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_campaign(client: AsyncClient, auth_headers: dict):
    campaign = await _create_campaign(client, auth_headers)
    resp = await client.patch(f"{PREFIX}/{campaign['id']}", headers=auth_headers, json={
        "name": "Q2 Auto Campaign",
        "status": "active",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Q2 Auto Campaign"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_update_campaign_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers, json={
        "name": "Ghost",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_campaign(client: AsyncClient, auth_headers: dict):
    campaign = await _create_campaign(client, auth_headers)
    resp = await client.delete(f"{PREFIX}/{campaign['id']}", headers=auth_headers)
    assert resp.status_code == 204

    resp2 = await client.get(f"{PREFIX}/{campaign['id']}", headers=auth_headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_deleted_campaign_excluded_from_list(client: AsyncClient, auth_headers: dict):
    campaign = await _create_campaign(client, auth_headers)
    await client.delete(f"{PREFIX}/{campaign['id']}", headers=auth_headers)

    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    ids = [item["id"] for item in resp.json()["items"]]
    assert campaign["id"] not in ids


@pytest.mark.asyncio
async def test_campaign_config_persisted(client: AsyncClient, auth_headers: dict):
    campaign = await _create_campaign(
        client, auth_headers,
        config={"max_calls_per_day": 50, "call_window": "9am-5pm"},
    )
    resp = await client.get(f"{PREFIX}/{campaign['id']}", headers=auth_headers)
    assert resp.json()["config"]["max_calls_per_day"] == 50


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    resp = await client.get(f"{PREFIX}/")
    assert resp.status_code == 401
