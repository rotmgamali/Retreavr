from __future__ import annotations

"""
In-process pub/sub event bus using asyncio.Queue for real-time event distribution.
Publishers: Call Manager, Lead Service, Agent Service
Subscribers: WebSocket Connection Manager, Notification Service
"""
import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Awaitable


class EventType(str, Enum):
    # Call events
    CALL_STARTED = "call.started"
    CALL_ENDED = "call.ended"
    CALL_SENTIMENT_UPDATE = "call.sentiment_update"
    CALL_STATUS_CHANGED = "call.status_changed"
    CALL_TRANSCRIPT_UPDATE = "call.transcript_update"

    # Lead events
    LEAD_STATUS_CHANGED = "lead.status_changed"
    LEAD_CREATED = "lead.created"
    LEAD_UPDATED = "lead.updated"

    # Agent events
    AGENT_STATUS_CHANGED = "agent.status_changed"

    # KPI / dashboard
    KPI_UPDATE = "kpi.update"


@dataclass
class Event:
    event_type: EventType
    org_id: str
    payload: dict[str, Any]
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "org_id": self.org_id,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }


logger = logging.getLogger(__name__)

# Type alias for subscriber callbacks
Subscriber = Callable[[Event], Awaitable[None]]


class EventBus:
    """Singleton in-process pub/sub event bus."""

    def __init__(self) -> None:
        # Map of event_type -> list of subscriber callbacks
        self._subscribers: dict[EventType, list[Subscriber]] = {}
        # Internal queue for async distribution
        self._queue: asyncio.Queue[Event] = asyncio.Queue()
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the background dispatch loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._dispatch_loop())

    async def stop(self) -> None:
        """Gracefully stop the dispatch loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def subscribe(self, event_type: EventType, callback: Subscriber) -> None:
        """Register a subscriber for a specific event type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def unsubscribe(self, event_type: EventType, callback: Subscriber) -> None:
        """Remove a subscriber."""
        if event_type in self._subscribers:
            try:
                self._subscribers[event_type].remove(callback)
            except ValueError:
                pass

    async def publish(self, event: Event) -> None:
        """Publish an event to the bus."""
        await self._queue.put(event)

    async def _dispatch_loop(self) -> None:
        """Background loop that dispatches events to subscribers."""
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            subscribers = self._subscribers.get(event.event_type, [])
            if subscribers:
                await asyncio.gather(
                    *[self._safe_call(sub, event) for sub in subscribers],
                    return_exceptions=True,
                )
            self._queue.task_done()

    @staticmethod
    async def _safe_call(callback: Subscriber, event: Event) -> None:
        try:
            await callback(event)
        except Exception:
            logger.exception("Event bus subscriber failed for event %s", event.event_type)


# Global singleton
event_bus = EventBus()
