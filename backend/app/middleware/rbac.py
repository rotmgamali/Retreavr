from __future__ import annotations

from functools import wraps
from typing import Callable

from fastapi import HTTPException, status

from app.models.user import ROLE_HIERARCHY, User, UserRole


def has_role(user: User, minimum_role: UserRole) -> bool:
    """Return True if the user's role meets or exceeds the minimum required role."""
    return ROLE_HIERARCHY.get(user.role, 0) >= ROLE_HIERARCHY.get(minimum_role, 0)


def assert_role(user: User, minimum_role: UserRole) -> None:
    """Raise HTTP 403 if the user doesn't meet the minimum role."""
    if not has_role(user, minimum_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{minimum_role.value}' or higher required",
        )


def assert_same_org(user: User, resource_org_id) -> None:
    """Raise HTTP 403 if the user's org doesn't match the resource org (unless superadmin)."""
    if user.role == UserRole.superadmin:
        return
    if str(user.org_id) != str(resource_org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: resource belongs to a different organization",
        )
