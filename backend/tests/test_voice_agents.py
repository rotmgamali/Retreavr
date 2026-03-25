"""Tests for /api/v1/voice-agents CRUD endpoints."""
import uuid
import pytest
from httpx import AsyncClient


PREFIX = "/api/v1/voice-agents"


async def _create_agent(client: AsyncClient, auth_headers: dict, **overrides) -> dict:
    payload = {
        "name": f"Agent-{uuid.uuid4().hex[:6]}",
        "persona": "Friendly insurance assistant",
        "system_prompt": "You are a helpful insurance sales agent.",
        "voice": "alloy",
        "status": "draft",
    }
    payload.update(overrides)
    resp = await client.post(f"{PREFIX}/", headers=auth_headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_voice_agent(client: AsyncClient, auth_headers: dict):
    data = await _create_agent(client, auth_headers)
    assert data["voice"] == "alloy"
    assert data["status"] == "draft"
    assert "id" in data
    assert "organization_id" in data


@pytest.mark.asyncio
async def test_list_voice_agents(client: AsyncClient, auth_headers: dict):
    await _create_agent(client, auth_headers)
    await _create_agent(client, auth_headers)

    resp = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2


@pytest.mark.asyncio
async def test_get_voice_agent(client: AsyncClient, auth_headers: dict):
    agent = await _create_agent(client, auth_headers)
    resp = await client.get(f"{PREFIX}/{agent['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == agent["id"]


@pytest.mark.asyncio
async def test_get_voice_agent_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_voice_agent(client: AsyncClient, auth_headers: dict):
    agent = await _create_agent(client, auth_headers)
    resp = await client.patch(f"{PREFIX}/{agent['id']}", headers=auth_headers, json={
        "name": "Updated Agent",
        "status": "active",
        "voice": "nova",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Agent"
    assert data["status"] == "active"
    assert data["voice"] == "nova"


@pytest.mark.asyncio
async def test_update_voice_agent_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers, json={
        "name": "Ghost",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_voice_agent(client: AsyncClient, auth_headers: dict):
    agent = await _create_agent(client, auth_headers)
    resp = await client.delete(f"{PREFIX}/{agent['id']}", headers=auth_headers)
    assert resp.status_code == 204

    # Agent should be marked inactive, still retrievable
    get_resp = await client.get(f"{PREFIX}/{agent['id']}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "inactive"


@pytest.mark.asyncio
async def test_delete_voice_agent_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete(f"{PREFIX}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_tenant_isolation(client: AsyncClient, db_session, auth_headers: dict):
    """Agents from other orgs are not visible."""
    from app.models.organization import Organization
    from app.models.user import User
    from app.models.voice_agents import VoiceAgent
    from app.services.auth import hash_password, create_access_token

    # Create a second org + user + agent
    other_org = Organization(name="Other Co", slug=f"other-{uuid.uuid4().hex[:6]}")
    db_session.add(other_org)
    await db_session.flush()

    other_agent = VoiceAgent(name="Other Agent", organization_id=other_org.id)
    db_session.add(other_agent)
    await db_session.flush()

    # Original org should not see the other org's agent
    resp = await client.get(f"{PREFIX}/{other_agent.id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    resp = await client.get(f"{PREFIX}/")
    assert resp.status_code == 401
