from typing import List, Optional

"""
Dashboard Event Stream WebSocket Route.

WS /ws/dashboard/{org_id}

Streams real-time org-scoped events to authenticated dashboard clients.
Events: call.started/ended, call.sentiment_update, lead.status_changed,
        agent.status_changed, kpi.update

Auth: JWT required (any authenticated user within the org).
Token via ?token= query param or first text message.
"""
import asyncio
import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.realtime.auth import WSAuthError, decode_ws_token
from app.services.realtime.connection_manager import Connection, connection_manager

logger = logging.getLogger(__name__)

router = APIRouter()

PING_INTERVAL = 30  # seconds

DASHBOARD_EVENT_TYPES = {
    "call.started",
    "call.ended",
    "call.sentiment_update",
    "lead.status_changed",
    "agent.status_changed",
    "kpi.update",
}


@router.websocket("/ws/dashboard/{org_id}")
async def dashboard_stream(
    websocket: WebSocket,
    org_id: str,
    token: Optional[str] = Query(default=None),
):
    """
    WebSocket endpoint for the real-time org dashboard event stream.
    Filters events to the requesting org for multi-tenancy.
    """
    await websocket.accept()

    # --- Auth handshake ---
    if not token:
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            data = json.loads(raw)
            token = data.get("token")
        except (asyncio.TimeoutError, json.JSONDecodeError, KeyError):
            await websocket.send_text(json.dumps({"type": "error", "message": "auth_timeout"}))
            await websocket.close(code=4001)
            return

    try:
        payload = decode_ws_token(token)
    except WSAuthError as exc:
        await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
        await websocket.close(code=4003)
        return

    user_id = str(payload["sub"])
    token_org_id = str(payload.get("org_id", ""))
    role = str(payload.get("role", ""))

    # Org isolation: users can only subscribe to their own org's dashboard
    if token_org_id != org_id:
        await websocket.send_text(json.dumps({"type": "error", "message": "org_mismatch"}))
        await websocket.close(code=4003)
        return

    conn = Connection(websocket=websocket, user_id=user_id, org_id=org_id, role=role)
    await connection_manager.connect(conn)

    dashboard_room = f"dashboard:{org_id}"
    org_room = f"org:{org_id}"
    await connection_manager.subscribe(websocket, dashboard_room)
    await connection_manager.subscribe(websocket, org_room)

    await websocket.send_text(
        json.dumps({
            "type": "connected",
            "org_id": org_id,
            "subscribed_events": sorted(DASHBOARD_EVENT_TYPES),
        })
    )

    ping_task = asyncio.create_task(_ping_loop(websocket))

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=PING_INTERVAL + 5)
            except asyncio.TimeoutError:
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "pong":
                continue

            # Clients can request a specific event filter (optional)
            if msg.get("type") == "filter":
                # Acknowledged but not enforced server-side — filtering is
                # client-side responsibility on the dashboard for now.
                await websocket.send_text(json.dumps({"type": "filter_ack"}))

    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        await connection_manager.disconnect(websocket)


async def _ping_loop(websocket: WebSocket) -> None:
    try:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            await connection_manager.ping(websocket)
    except asyncio.CancelledError:
        pass
    except Exception:
        pass
