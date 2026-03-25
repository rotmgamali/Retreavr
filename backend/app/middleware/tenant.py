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
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
            try:
                payload = validate_access_token(token)
                org_id_str = payload.get("org_id")
                role = payload.get("role", "")
                if org_id_str:
                    request.state.org_id = uuid.UUID(org_id_str)
                request.state.is_superadmin = role == "superadmin"
            except (JWTError, ValueError):
                # Invalid token — let the route-level dependency handle rejection
                pass

        return await call_next(request)
