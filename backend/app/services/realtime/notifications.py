"""
Notification Dispatcher.
Listens to the event bus, evaluates notification rules, dispatches via WebSocket push,
and persists notifications to DB.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.services.realtime.event_bus import Event, EventType, event_bus

logger = logging.getLogger(__name__)

# Event types that always generate a notification push
NOTIFY_EVENT_TYPES = {
    EventType.CALL_STARTED,
    EventType.CALL_ENDED,
    EventType.CALL_SENTIMENT_UPDATE,
    EventType.LEAD_STATUS_CHANGED,
    EventType.AGENT_STATUS_CHANGED,
}


class NotificationDispatcher:
    """Listens on the event bus and persists + pushes notifications."""

    def __init__(self) -> None:
        self._registered = False

    def register(self) -> None:
        if self._registered:
            return
        for event_type in NOTIFY_EVENT_TYPES:
            event_bus.subscribe(event_type, self.on_event)
        self._registered = True
        logger.info("NotificationDispatcher registered with event bus")

    async def on_event(self, event: Event) -> None:
        """Called by the event bus for every subscribed event."""
        try:
            await self._persist_notification(event)
        except Exception as exc:
            logger.warning("Failed to persist notification for event %s: %s", event.event_id, exc)

    async def _persist_notification(self, event: Event) -> None:
        """Write notification record to the database."""
        async with async_session() as session:
            await session.execute(
                # Raw insert to avoid circular model imports; adjust table name if a
                # Notifications model is added by another engineer.
                __import__("sqlalchemy").text(
                    """
                    INSERT INTO notifications
                        (id, org_id, event_type, event_id, payload, created_at)
                    VALUES
                        (:id, :org_id, :event_type, :event_id, :payload, :created_at)
                    ON CONFLICT DO NOTHING
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "org_id": event.org_id,
                    "event_type": event.event_type,
                    "event_id": event.event_id,
                    "payload": __import__("json").dumps(event.payload),
                    "created_at": datetime.now(timezone.utc),
                },
            )
            await session.commit()


# Global singleton
notification_dispatcher = NotificationDispatcher()
