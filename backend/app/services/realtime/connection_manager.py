from __future__ import annotations

"""
WebSocket Connection Manager.
Handles authenticated WebSocket connections with room-based subscriptions:
  - org:{org_id}       → dashboard/org-wide events
  - call:{call_id}     → per-call events
  - dashboard:{org_id} → dashboard KPI stream
"""
import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.services.realtime.event_bus import Event, EventType, event_bus

logger = logging.getLogger(__name__)


@dataclass(eq=False)
class Connection:
    websocket: WebSocket
    user_id: str
    org_id: str
    role: str
    rooms: set[str] = field(default_factory=set)


class ConnectionManager:
    """Manages all active WebSocket connections with room-based pub/sub."""

    def __init__(self) -> None:
        # room_key -> set of Connection objects
        self._rooms: dict[str, set[Connection]] = {}
        # websocket id -> Connection
        self._connections: dict[int, Connection] = {}
        self._lock = asyncio.Lock()

    async def connect(self, conn: Connection) -> None:
        async with self._lock:
            self._connections[id(conn.websocket)] = conn
        logger.info("WS connected: user=%s org=%s", conn.user_id, conn.org_id)

    async def disconnect(self, websocket: WebSocket) -> Connection | None:
        async with self._lock:
            conn = self._connections.pop(id(websocket), None)
            if conn:
                for room in list(conn.rooms):
                    self._rooms.get(room, set()).discard(conn)
        if conn:
            logger.info("WS disconnected: user=%s org=%s", conn.user_id, conn.org_id)
        return conn

    async def subscribe(self, websocket: WebSocket, room: str) -> None:
        async with self._lock:
            conn = self._connections.get(id(websocket))
            if not conn:
                return
            conn.rooms.add(room)
            if room not in self._rooms:
                self._rooms[room] = set()
            self._rooms[room].add(conn)
        logger.debug("WS subscribed: user=%s room=%s", conn.user_id, room)

    async def unsubscribe(self, websocket: WebSocket, room: str) -> None:
        async with self._lock:
            conn = self._connections.get(id(websocket))
            if not conn:
                return
            conn.rooms.discard(room)
            self._rooms.get(room, set()).discard(conn)

    async def broadcast_to_room(self, room: str, message: dict[str, Any]) -> None:
        """Send a message to all connections subscribed to a room."""
        async with self._lock:
            conns = list(self._rooms.get(room, set()))

        if not conns:
            return

        data = json.dumps(message)
        dead: list[Connection] = []
        for conn in conns:
            try:
                await conn.websocket.send_text(data)
            except Exception:
                dead.append(conn)

        # Clean up dead connections
        for conn in dead:
            await self.disconnect(conn.websocket)

    async def send_to_connection(self, websocket: WebSocket, message: dict[str, Any]) -> bool:
        """Send directly to one connection. Returns False if send failed."""
        try:
            await websocket.send_text(json.dumps(message))
            return True
        except Exception:
            await self.disconnect(websocket)
            return False

    # ------------------------------------------------------------------
    # Event bus integration
    # ------------------------------------------------------------------

    async def handle_event(self, event: Event) -> None:
        """Route an event from the event bus to the appropriate rooms."""
        org_room = f"org:{event.org_id}"
        dashboard_room = f"dashboard:{event.org_id}"
        msg = event.to_dict()

        # Broadcast org-wide
        await self.broadcast_to_room(org_room, msg)

        # Dashboard events go to the dashboard room
        dashboard_event_types = {
            EventType.CALL_STARTED,
            EventType.CALL_ENDED,
            EventType.CALL_SENTIMENT_UPDATE,
            EventType.LEAD_STATUS_CHANGED,
            EventType.AGENT_STATUS_CHANGED,
            EventType.KPI_UPDATE,
        }
        if event.event_type in dashboard_event_types:
            await self.broadcast_to_room(dashboard_room, msg)

        # Per-call events
        call_id = event.payload.get("call_id")
        if call_id:
            await self.broadcast_to_room(f"call:{call_id}", msg)

    def register_with_event_bus(self) -> None:
        """Subscribe this manager to all relevant event types on the global event bus."""
        for event_type in EventType:
            event_bus.subscribe(event_type, self.handle_event)

    # ------------------------------------------------------------------
    # Ping / heartbeat helpers
    # ------------------------------------------------------------------

    async def ping(self, websocket: WebSocket) -> None:
        await self.send_to_connection(websocket, {"type": "ping"})


# Global singleton
connection_manager = ConnectionManager()
