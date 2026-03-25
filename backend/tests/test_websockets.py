"""
WebSocket endpoint tests for RET-43.

Covers:
- /ws/dashboard/{org_id}: connect, auth (query param + message), events, org isolation
- /ws/calls/{call_id}/monitor: supervisor auth, role rejection, mode switching
- Connection manager: cleanup on disconnect, room isolation
- Event bus: publish → subscriber delivery, org-scoped routing
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from jose import jwt
from starlette.testclient import TestClient

from app.api.routes.ws_calls import router as ws_calls_router
from app.api.routes.ws_dashboard import router as ws_dashboard_router
from app.services.realtime.connection_manager import ConnectionManager
from app.services.realtime.event_bus import Event, EventBus, EventType

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

SECRET = "test-secret-key"
ALGORITHM = "HS256"
ORG_A = str(uuid.uuid4())
ORG_B = str(uuid.uuid4())
CALL_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())


def make_token(
    sub: str = USER_ID,
    org_id: str = ORG_A,
    role: str = "agent",
    secret: str = SECRET,
    expire_delta: timedelta = timedelta(minutes=30),
) -> str:
    expire = datetime.now(timezone.utc) + expire_delta
    payload = {"sub": sub, "org_id": org_id, "role": role, "exp": expire}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def make_supervisor_token(org_id: str = ORG_A) -> str:
    return make_token(role="manager", org_id=org_id)


def make_expired_token() -> str:
    return make_token(expire_delta=timedelta(seconds=-1))


@pytest.fixture()
def ws_app():
    """Minimal FastAPI app with only WS routes — no DB, no middleware."""
    app = FastAPI()
    app.include_router(ws_dashboard_router)
    app.include_router(ws_calls_router)
    return app


@pytest.fixture()
def client(ws_app):
    with TestClient(ws_app, raise_server_exceptions=True) as c:
        yield c


# Patch out the config secret so our test tokens validate correctly
@pytest.fixture(autouse=True)
def patch_settings():
    with patch("app.services.realtime.auth.settings") as mock_settings:
        mock_settings.secret_key = SECRET
        mock_settings.algorithm = ALGORITHM
        yield mock_settings


# ---------------------------------------------------------------------------
# Dashboard WebSocket: /ws/dashboard/{org_id}
# ---------------------------------------------------------------------------


class TestDashboardAuth:
    def test_auth_via_query_param(self, client):
        """Valid JWT in query param → connected message received."""
        token = make_token()
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "connected"
        assert msg["org_id"] == ORG_A
        assert "subscribed_events" in msg

    def test_auth_via_first_message(self, client):
        """Valid JWT sent as first text message → connected."""
        token = make_token()
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}") as ws:
            ws.send_text(json.dumps({"token": token}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "connected"

    def test_invalid_token_rejected(self, client):
        """Tampered JWT → error frame, connection closed with 4003."""
        bad_token = make_token(secret="wrong-secret")
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}?token={bad_token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"
        assert "Invalid token" in msg["message"]

    def test_expired_token_rejected(self, client):
        """Expired JWT → error frame."""
        token = make_expired_token()
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"

    def test_no_token_timeout_sends_error(self, client):
        """No token at all → auth_timeout error after read (we send garbage JSON)."""
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}") as ws:
            # Send malformed JSON — triggers json.JSONDecodeError path
            ws.send_text("not-json")
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"
        assert "auth_timeout" in msg["message"]

    def test_missing_sub_rejected(self, client):
        """Token without sub → error."""
        expire = datetime.now(timezone.utc) + timedelta(minutes=30)
        token = jwt.encode({"org_id": ORG_A, "role": "agent", "exp": expire}, SECRET, algorithm=ALGORITHM)
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"
        assert "missing subject" in msg["message"].lower()


class TestDashboardOrgIsolation:
    def test_org_mismatch_rejected(self, client):
        """Token org_id != URL org_id → org_mismatch error."""
        token = make_token(org_id=ORG_A)
        with client.websocket_connect(f"/ws/dashboard/{ORG_B}?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"
        assert "org_mismatch" in msg["message"]

    def test_correct_org_connected(self, client):
        """Token org_id matches URL → allowed."""
        token = make_token(org_id=ORG_B)
        with client.websocket_connect(f"/ws/dashboard/{ORG_B}?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "connected"
        assert msg["org_id"] == ORG_B


class TestDashboardMessages:
    def test_filter_message_acknowledged(self, client):
        """Client sending a filter message gets filter_ack."""
        token = make_token()
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}?token={token}") as ws:
            ws.receive_text()  # connected
            ws.send_text(json.dumps({"type": "filter", "events": ["call.started"]}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "filter_ack"

    def test_pong_message_does_not_crash(self, client):
        """Sending pong back does not cause any error response."""
        token = make_token()
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}?token={token}") as ws:
            ws.receive_text()  # connected
            ws.send_text(json.dumps({"type": "pong"}))
            # No crash — connection still alive
            ws.send_text(json.dumps({"type": "filter"}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "filter_ack"

    def test_subscribed_events_list(self, client):
        """Connected message includes all expected dashboard event types."""
        expected = {
            "call.started", "call.ended", "call.sentiment_update",
            "lead.status_changed", "agent.status_changed", "kpi.update",
        }
        token = make_token()
        with client.websocket_connect(f"/ws/dashboard/{ORG_A}?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert set(msg["subscribed_events"]) == expected


# ---------------------------------------------------------------------------
# Call Monitor WebSocket: /ws/calls/{call_id}/monitor
# ---------------------------------------------------------------------------


class TestCallMonitorAuth:
    def test_supervisor_can_connect(self, client):
        """Manager role JWT → connected with listen_in mode."""
        token = make_supervisor_token()
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "connected"
        assert msg["call_id"] == CALL_ID
        assert msg["mode"] == "listen_in"

    def test_agent_role_rejected(self, client):
        """Non-supervisor role → error, connection closed."""
        token = make_token(role="agent")
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"
        assert "insufficient" in msg["message"].lower()

    def test_admin_role_allowed(self, client):
        """Admin role → supervisor access granted."""
        token = make_token(role="admin")
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "connected"

    def test_superadmin_role_allowed(self, client):
        """Superadmin role → supervisor access granted."""
        token = make_token(role="superadmin")
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "connected"

    def test_invalid_token_rejected(self, client):
        """Invalid JWT → error frame."""
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token=garbage.token.here") as ws:
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"

    def test_auth_via_first_message(self, client):
        """Supervisor token sent as first message → connected."""
        token = make_supervisor_token()
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor") as ws:
            ws.send_text(json.dumps({"token": token}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "connected"


class TestCallMonitorModes:
    def test_set_mode_whisper(self, client):
        """Supervisor can switch to whisper mode."""
        token = make_supervisor_token()
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            ws.receive_text()  # connected
            ws.send_text(json.dumps({"type": "set_mode", "mode": "whisper"}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "mode_changed"
        assert msg["mode"] == "whisper"

    def test_set_mode_takeover(self, client):
        """Supervisor can switch to takeover mode."""
        token = make_supervisor_token()
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            ws.receive_text()  # connected
            ws.send_text(json.dumps({"type": "set_mode", "mode": "takeover"}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "mode_changed"
        assert msg["mode"] == "takeover"

    def test_set_mode_listen_in(self, client):
        """Supervisor can switch back to listen_in mode."""
        token = make_supervisor_token()
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            ws.receive_text()  # connected
            ws.send_text(json.dumps({"type": "set_mode", "mode": "listen_in"}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "mode_changed"
        assert msg["mode"] == "listen_in"

    def test_invalid_mode_ignored(self, client):
        """Invalid mode value → no mode_changed response (silently ignored)."""
        token = make_supervisor_token()
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            ws.receive_text()  # connected
            ws.send_text(json.dumps({"type": "set_mode", "mode": "hack"}))
            ws.send_text(json.dumps({"type": "set_mode", "mode": "listen_in"}))
            msg = json.loads(ws.receive_text())
        # The valid listen_in follows — confirms the invalid was skipped
        assert msg["mode"] == "listen_in"

    def test_pong_does_not_crash(self, client):
        """Sending pong doesn't crash the call monitor."""
        token = make_supervisor_token()
        with client.websocket_connect(f"/ws/calls/{CALL_ID}/monitor?token={token}") as ws:
            ws.receive_text()  # connected
            ws.send_text(json.dumps({"type": "pong"}))
            ws.send_text(json.dumps({"type": "set_mode", "mode": "listen_in"}))
            msg = json.loads(ws.receive_text())
        assert msg["type"] == "mode_changed"


# ---------------------------------------------------------------------------
# Connection Manager: unit tests (no HTTP/WS overhead)
# ---------------------------------------------------------------------------


class TestConnectionManager:
    @pytest.fixture()
    def manager(self):
        return ConnectionManager()

    def _make_ws(self):
        """Create a mock WebSocket with async send_text."""
        ws = AsyncMock()
        ws.send_text = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_connect_registers_connection(self, manager):
        from app.services.realtime.connection_manager import Connection
        ws = self._make_ws()
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="agent")
        await manager.connect(conn)
        assert id(ws) in manager._connections

    @pytest.mark.asyncio
    async def test_disconnect_removes_connection(self, manager):
        from app.services.realtime.connection_manager import Connection
        ws = self._make_ws()
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="agent")
        await manager.connect(conn)
        await manager.subscribe(ws, f"org:{ORG_A}")
        returned = await manager.disconnect(ws)
        assert id(ws) not in manager._connections
        assert returned is conn
        # Room should no longer contain the connection
        assert conn not in manager._rooms.get(f"org:{ORG_A}", set())

    @pytest.mark.asyncio
    async def test_subscribe_and_broadcast(self, manager):
        from app.services.realtime.connection_manager import Connection
        ws = self._make_ws()
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="agent")
        await manager.connect(conn)
        await manager.subscribe(ws, "test-room")
        await manager.broadcast_to_room("test-room", {"type": "test"})
        ws.send_text.assert_called_once_with(json.dumps({"type": "test"}))

    @pytest.mark.asyncio
    async def test_broadcast_to_empty_room_is_safe(self, manager):
        """Broadcasting to a room with no subscribers does not raise."""
        await manager.broadcast_to_room("nonexistent-room", {"type": "noop"})

    @pytest.mark.asyncio
    async def test_org_isolation_in_rooms(self, manager):
        """Two connections in different org rooms do not receive each other's messages."""
        from app.services.realtime.connection_manager import Connection
        ws_a = self._make_ws()
        ws_b = self._make_ws()
        conn_a = Connection(websocket=ws_a, user_id="u1", org_id=ORG_A, role="agent")
        conn_b = Connection(websocket=ws_b, user_id="u2", org_id=ORG_B, role="agent")
        await manager.connect(conn_a)
        await manager.connect(conn_b)
        await manager.subscribe(ws_a, f"org:{ORG_A}")
        await manager.subscribe(ws_b, f"org:{ORG_B}")

        await manager.broadcast_to_room(f"org:{ORG_A}", {"type": "org_a_event"})
        ws_a.send_text.assert_called_once()
        ws_b.send_text.assert_not_called()

    @pytest.mark.asyncio
    async def test_dead_connection_cleaned_up_on_broadcast(self, manager):
        """A connection whose send_text raises is removed during broadcast."""
        from app.services.realtime.connection_manager import Connection
        ws = self._make_ws()
        ws.send_text.side_effect = RuntimeError("connection closed")
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="agent")
        await manager.connect(conn)
        await manager.subscribe(ws, "room")
        await manager.broadcast_to_room("room", {"type": "test"})
        # Connection should have been removed
        assert id(ws) not in manager._connections

    @pytest.mark.asyncio
    async def test_disconnect_unknown_ws_returns_none(self, manager):
        """Disconnecting a WS that was never connected returns None safely."""
        ws = self._make_ws()
        result = await manager.disconnect(ws)
        assert result is None

    @pytest.mark.asyncio
    async def test_ping_sends_ping_message(self, manager):
        from app.services.realtime.connection_manager import Connection
        ws = self._make_ws()
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="agent")
        await manager.connect(conn)
        await manager.ping(ws)
        ws.send_text.assert_called_once_with(json.dumps({"type": "ping"}))


# ---------------------------------------------------------------------------
# Event Bus: unit tests
# ---------------------------------------------------------------------------


class TestEventBus:
    @pytest.mark.asyncio
    async def test_publish_dispatches_to_subscriber(self):
        bus = EventBus()
        await bus.start()
        received: list[Event] = []

        async def handler(event: Event) -> None:
            received.append(event)

        bus.subscribe(EventType.CALL_STARTED, handler)
        event = Event(
            event_type=EventType.CALL_STARTED,
            org_id=ORG_A,
            payload={"call_id": str(uuid.uuid4())},
        )
        await bus.publish(event)
        await asyncio.sleep(0.05)  # let dispatch loop run
        await bus.stop()
        assert len(received) == 1
        assert received[0].event_id == event.event_id

    @pytest.mark.asyncio
    async def test_subscriber_only_gets_its_event_type(self):
        bus = EventBus()
        await bus.start()
        call_events: list[Event] = []
        lead_events: list[Event] = []

        async def on_call(e: Event) -> None:
            call_events.append(e)

        async def on_lead(e: Event) -> None:
            lead_events.append(e)

        bus.subscribe(EventType.CALL_STARTED, on_call)
        bus.subscribe(EventType.LEAD_STATUS_CHANGED, on_lead)

        await bus.publish(Event(event_type=EventType.CALL_STARTED, org_id=ORG_A, payload={}))
        await bus.publish(Event(event_type=EventType.LEAD_STATUS_CHANGED, org_id=ORG_A, payload={}))
        await asyncio.sleep(0.05)
        await bus.stop()

        assert len(call_events) == 1
        assert len(lead_events) == 1

    @pytest.mark.asyncio
    async def test_faulty_subscriber_does_not_crash_bus(self):
        bus = EventBus()
        await bus.start()
        good_received: list[Event] = []

        async def bad_handler(e: Event) -> None:
            raise ValueError("subscriber bug")

        async def good_handler(e: Event) -> None:
            good_received.append(e)

        bus.subscribe(EventType.CALL_ENDED, bad_handler)
        bus.subscribe(EventType.CALL_ENDED, good_handler)

        await bus.publish(Event(event_type=EventType.CALL_ENDED, org_id=ORG_A, payload={}))
        await asyncio.sleep(0.05)
        await bus.stop()

        # Good handler still ran despite bad handler crashing
        assert len(good_received) == 1

    @pytest.mark.asyncio
    async def test_unsubscribe_stops_delivery(self):
        bus = EventBus()
        await bus.start()
        received: list[Event] = []

        async def handler(e: Event) -> None:
            received.append(e)

        bus.subscribe(EventType.KPI_UPDATE, handler)
        bus.unsubscribe(EventType.KPI_UPDATE, handler)

        await bus.publish(Event(event_type=EventType.KPI_UPDATE, org_id=ORG_A, payload={}))
        await asyncio.sleep(0.05)
        await bus.stop()
        assert len(received) == 0

    @pytest.mark.asyncio
    async def test_multiple_publishes_all_delivered(self):
        bus = EventBus()
        await bus.start()
        received: list[Event] = []

        async def handler(e: Event) -> None:
            received.append(e)

        bus.subscribe(EventType.AGENT_STATUS_CHANGED, handler)
        for _ in range(5):
            await bus.publish(
                Event(event_type=EventType.AGENT_STATUS_CHANGED, org_id=ORG_A, payload={})
            )
        await asyncio.sleep(0.1)
        await bus.stop()
        assert len(received) == 5

    @pytest.mark.asyncio
    async def test_event_to_dict_structure(self):
        event = Event(
            event_type=EventType.CALL_STARTED,
            org_id=ORG_A,
            payload={"call_id": "c1"},
        )
        d = event.to_dict()
        assert d["event_type"] == EventType.CALL_STARTED
        assert d["org_id"] == ORG_A
        assert d["payload"] == {"call_id": "c1"}
        assert "event_id" in d
        assert "timestamp" in d


# ---------------------------------------------------------------------------
# Connection Manager + Event Bus integration
# ---------------------------------------------------------------------------


class TestConnectionManagerEventBusIntegration:
    @pytest.mark.asyncio
    async def test_dashboard_event_delivered_to_subscribed_client(self):
        """Events published to the bus reach the correct dashboard room subscriber."""
        manager = ConnectionManager()
        bus = EventBus()
        await bus.start()
        bus.subscribe(EventType.CALL_STARTED, manager.handle_event)

        delivered: list[dict] = []
        ws = AsyncMock()

        async def capture_send_a(text: str) -> None:
            delivered.append(json.loads(text))

        ws.send_text = AsyncMock(side_effect=capture_send_a)

        from app.services.realtime.connection_manager import Connection
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="agent")
        await manager.connect(conn)
        await manager.subscribe(ws, f"dashboard:{ORG_A}")
        await manager.subscribe(ws, f"org:{ORG_A}")

        event = Event(
            event_type=EventType.CALL_STARTED,
            org_id=ORG_A,
            payload={"call_id": "cX"},
        )
        await bus.publish(event)
        await asyncio.sleep(0.05)
        await bus.stop()

        assert any(d.get("event_type") == "call.started" for d in delivered)

    @pytest.mark.asyncio
    async def test_event_for_different_org_not_delivered(self):
        """Events for ORG_B do not reach a client subscribed to ORG_A."""
        manager = ConnectionManager()
        bus = EventBus()
        await bus.start()
        bus.subscribe(EventType.CALL_STARTED, manager.handle_event)

        delivered: list[dict] = []
        ws = AsyncMock()

        async def capture_send_b(text: str) -> None:
            delivered.append(json.loads(text))

        ws.send_text = AsyncMock(side_effect=capture_send_b)

        from app.services.realtime.connection_manager import Connection
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="agent")
        await manager.connect(conn)
        # Only subscribed to ORG_A rooms
        await manager.subscribe(ws, f"dashboard:{ORG_A}")
        await manager.subscribe(ws, f"org:{ORG_A}")

        # Publish event for ORG_B
        await bus.publish(Event(
            event_type=EventType.CALL_STARTED,
            org_id=ORG_B,
            payload={"call_id": "cY"},
        ))
        await asyncio.sleep(0.05)
        await bus.stop()

        assert len(delivered) == 0

    @pytest.mark.asyncio
    async def test_call_event_delivered_to_call_room_subscriber(self):
        """call.status_changed events with a call_id are delivered to call:{call_id} room."""
        manager = ConnectionManager()
        bus = EventBus()
        await bus.start()
        bus.subscribe(EventType.CALL_STATUS_CHANGED, manager.handle_event)

        delivered: list[dict] = []
        ws = AsyncMock()

        async def capture_send_c(text: str) -> None:
            delivered.append(json.loads(text))

        ws.send_text = AsyncMock(side_effect=capture_send_c)

        from app.services.realtime.connection_manager import Connection
        conn = Connection(websocket=ws, user_id="u1", org_id=ORG_A, role="manager")
        await manager.connect(conn)
        await manager.subscribe(ws, f"call:{CALL_ID}")

        await bus.publish(Event(
            event_type=EventType.CALL_STATUS_CHANGED,
            org_id=ORG_A,
            payload={"call_id": CALL_ID, "mode": "whisper"},
        ))
        await asyncio.sleep(0.05)
        await bus.stop()

        assert any(d.get("event_type") == "call.status_changed" for d in delivered)
