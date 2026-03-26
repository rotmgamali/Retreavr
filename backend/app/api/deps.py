import uuid
from typing import Annotated, List, Optional

from fastapi import Depends, HTTPException, Request, status, WebSocket, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import ROLE_HIERARCHY, User, UserRole
from app.services.auth import get_user_by_id, validate_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = validate_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    user = await get_user_by_id(db, uuid.UUID(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Inhibit demo state overrides
    request.state.org_id = str(user.organization_id)
    request.state.user = user
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return current_user


def require_role(roles: List[str]):
    """Dependency factory that enforces minimum role."""

    async def _check_role(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        user_level = ROLE_HIERARCHY.get(UserRole(current_user.role), 0)
        required_level = min(ROLE_HIERARCHY.get(UserRole(r), 0) for r in roles)
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role. Required one of: {roles}",
            )
        return current_user

    return _check_role


async def get_current_org_ws(
    websocket: WebSocket,
    token: Annotated[Optional[str], Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> uuid.UUID:
    """Authentication for WebSockets using query parameter token."""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=401)
    
    try:
        payload = validate_access_token(token)
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=401)

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=401)

    user = await get_user_by_id(db, uuid.UUID(user_id))
    if not user or not user.is_active:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=401)

    return user.organization_id


async def get_current_org(
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> uuid.UUID:
    # Allow superadmins to impersonate a tenant via X-Tenant-Id header
    tenant_override = request.headers.get("x-tenant-id")
    if tenant_override and current_user.role == "superadmin":
        try:
            tenant_id = uuid.UUID(tenant_override)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Tenant-Id header",
            )
        from app.models.organization import Organization
        org = await db.get(Organization, tenant_id)
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found",
            )
        return tenant_id
    return current_user.organization_id
