"""Tests for /api/v1/calls CRUD endpoints."""
import uuid
import pytest
from httpx import AsyncClient


PREFIX = "/api/v1/calls"


async def _create_call(client: AsyncClient, auth_headers: dict, **overrides) -> dict:
    payload = {
        "direction": "outbound",
        "status": "initiated",
        "phone_from": "+15550001111",
        "phone_to": "+15559998888",
    }
    payload.update(overrides)
    resp = await client.post(f"{PREFIX}/", headers=auth_headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_call(client: AsyncClient, auth_headers: dict):
    data = await _create_call(client, auth_headers)
    assert data["direction"] == "outbound"
    assert data["status"] == "initiated"
    assert data["is_deleted"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_list_calls(client: AsyncClient, auth_headers: dict):
    await _create_call(client, auth_headers)
    await _create_call(client, auth_headers)

    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2


@pytest.mark.asyncio
async def test_get_call(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    resp = await client.get(f"{PREFIX}/{call['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == call["id"]


@pytest.mark.asyncio
async def test_get_call_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_call(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    resp = await client.patch(f"{PREFIX}/{call['id']}", headers=auth_headers, json={
        "status": "completed",
        "duration": 120,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["duration"] == 120


@pytest.mark.asyncio
async def test_update_call_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers, json={
        "status": "completed",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_call(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    resp = await client.delete(f"{PREFIX}/{call['id']}", headers=auth_headers)
    assert resp.status_code == 204

    resp2 = await client.get(f"{PREFIX}/{call['id']}", headers=auth_headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_deleted_call_excluded_from_list(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    await client.delete(f"{PREFIX}/{call['id']}", headers=auth_headers)

    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    ids = [item["id"] for item in resp.json()["items"]]
    assert call["id"] not in ids


@pytest.mark.asyncio
async def test_create_and_get_transcript(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    call_id = call["id"]

    resp = await client.post(f"{PREFIX}/{call_id}/transcript", headers=auth_headers, json={
        "transcript": "Hello, this is a test transcript.",
        "language": "en",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["call_id"] == call_id
    assert data["transcript"] == "Hello, this is a test transcript."

    get_resp = await client.get(f"{PREFIX}/{call_id}/transcript", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["transcript"] == "Hello, this is a test transcript."


@pytest.mark.asyncio
async def test_get_transcript_not_found(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    resp = await client.get(f"{PREFIX}/{call['id']}/transcript", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_and_get_summary(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    call_id = call["id"]

    resp = await client.post(f"{PREFIX}/{call_id}/summary", headers=auth_headers, json={
        "summary": "Customer interested in auto insurance.",
        "key_points": {"interest": "auto", "budget": "medium"},
        "next_actions": {"follow_up": "schedule_demo"},
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["call_id"] == call_id
    assert data["summary"] == "Customer interested in auto insurance."

    get_resp = await client.get(f"{PREFIX}/{call_id}/summary", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["key_points"]["interest"] == "auto"


@pytest.mark.asyncio
async def test_get_summary_not_found(client: AsyncClient, auth_headers: dict):
    call = await _create_call(client, auth_headers)
    resp = await client.get(f"{PREFIX}/{call['id']}/summary", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    resp = await client.get(f"{PREFIX}/")
    assert resp.status_code == 401
