import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.system import AuditLog


async def log_audit_event(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Create an audit log entry."""
    entry = AuditLog(
        organization_id=org_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()
