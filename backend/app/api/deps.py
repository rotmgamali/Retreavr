import uuid
from typing import Annotated, List, Optional

from fastapi import Depends, HTTPException, Request, status
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
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

    user = await get_user_by_id(db, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

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


async def get_current_org(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> uuid.UUID:
    return current_user.organization_id
