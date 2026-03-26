import uuid

from fastapi import Request, Response
from jose import JWTError
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.auth import validate_access_token


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Extracts organization_id from the JWT access token and injects it into
    request.state so downstream handlers can use it for org-scoped DB queries.

    Superadmins bypass the org-scoping restriction (state.is_superadmin = True).
    Routes that don't carry a token are passed through unchanged.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Default states:
        request.state.org_id = None
        request.state.is_superadmin = False

        # Extract org_id and role from JWT:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = validate_access_token(token)
                request.state.org_id = uuid.UUID(payload.get("org_id"))
                request.state.is_superadmin = payload.get("role") == "superadmin"
            except (JWTError, ValueError, TypeError):
                # Invalid token - but we pass through and let Dependencies handle 401
                pass

        return await call_next(request)
