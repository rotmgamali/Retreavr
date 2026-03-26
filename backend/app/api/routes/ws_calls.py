from typing import List, Optional

"""
Live Call Monitor WebSocket Routes.

WS /ws/calls/{call_id}/monitor

Supports three supervisor modes sent by client after connection:
  - listen_in   : read-only audio/event stream
  - whisper     : supervisor audio → agent only
  - takeover    : supervisor takes over the call

Auth: JWT required (manager/admin/superadmin role).
Token via ?token= query param or first text message.
"""
import asyncio
import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.realtime.auth import WSAuthError, decode_ws_token, require_supervisor
from app.services.realtime.connection_manager import Connection, connection_manager
from app.services.realtime.event_bus import Event, EventType, event_bus

logger = logging.getLogger(__name__)

router = APIRouter()

PING_INTERVAL = 30  # seconds


@router.websocket("/ws/calls/{call_id}/monitor")
async def call_monitor(
    websocket: WebSocket,
    call_id: str,
    token: Optional[str] = Query(default=None),
):
    """
    WebSocket endpoint for live call monitoring.
    Supervisors can listen-in, whisper, or take over active calls.
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
        require_supervisor(payload)
    except WSAuthError as exc:
        await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
        await websocket.close(code=4003)
        return

    user_id = str(payload["sub"])
    org_id = str(payload.get("org_id", ""))
    role = str(payload.get("role", ""))

    # Verify the call belongs to the supervisor's organization
    from app.services.telephony.call_manager import get_call_by_id
    from app.core.database import get_db as _get_db
    async for db in _get_db():
        call = await get_call_by_id(db, call_id)
        if call is None:
            await websocket.send_text(json.dumps({"type": "error", "message": "call_not_found"}))
            await websocket.close(code=4004)
            return
        if role != "superadmin" and str(call.organization_id) != org_id:
            await websocket.send_text(json.dumps({"type": "error", "message": "access_denied"}))
            await websocket.close(code=4003)
            return
        break

    conn = Connection(websocket=websocket, user_id=user_id, org_id=org_id, role=role)
    await connection_manager.connect(conn)

    call_room = f"call:{call_id}"
    await connection_manager.subscribe(websocket, call_room)

    await websocket.send_text(
        json.dumps({"type": "connected", "call_id": call_id, "mode": "listen_in"})
    )

    current_mode = "listen_in"
    ping_task = asyncio.create_task(_ping_loop(websocket, call_id))

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=PING_INTERVAL + 5)
            except asyncio.TimeoutError:
                # Client hasn't responded to ping, disconnect
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "pong":
                continue

            if msg_type == "set_mode":
                new_mode = msg.get("mode")
                if new_mode in ("listen_in", "whisper", "takeover"):
                    current_mode = new_mode
                    await _publish_mode_change(call_id, org_id, user_id, current_mode)
                    await websocket.send_text(
                        json.dumps({"type": "mode_changed", "mode": current_mode})
                    )

            elif msg_type == "audio_chunk" and current_mode in ("whisper", "takeover"):
                # Forward supervisor audio to call room (other subscribers handle routing)
                await event_bus.publish(
                    Event(
                        event_type=EventType.CALL_STATUS_CHANGED,
                        org_id=org_id,
                        payload={
                            "call_id": call_id,
                            "supervisor_id": user_id,
                            "mode": current_mode,
                            "audio_chunk": msg.get("data"),
                        },
                    )
                )

    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        await connection_manager.disconnect(websocket)

        # If supervisor was in takeover, publish release event
        if current_mode == "takeover":
            await event_bus.publish(
                Event(
                    event_type=EventType.CALL_STATUS_CHANGED,
                    org_id=org_id,
                    payload={
                        "call_id": call_id,
                        "supervisor_id": user_id,
                        "mode": "released",
                    },
                )
            )


async def _ping_loop(websocket: WebSocket, call_id: str) -> None:
    """Send periodic pings to keep the connection alive."""
    try:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            await connection_manager.ping(websocket)
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


async def _publish_mode_change(call_id: str, org_id: str, user_id: str, mode: str) -> None:
    await event_bus.publish(
        Event(
            event_type=EventType.CALL_STATUS_CHANGED,
            org_id=org_id,
            payload={
                "call_id": call_id,
                "supervisor_id": user_id,
                "mode": mode,
                "event": "supervisor_mode_change",
            },
        )
    )
