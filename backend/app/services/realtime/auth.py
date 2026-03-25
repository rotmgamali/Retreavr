"""
WebSocket JWT authentication helpers.
Token can be provided as:
  1. Query parameter: ?token=<jwt>
  2. First text message after connection
"""
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

REQUIRED_SUPERVISOR_ROLES = {"manager", "admin", "superadmin"}


class WSAuthError(Exception):
    pass


def decode_ws_token(token: str) -> dict:
    """Decode and validate a JWT token. Returns the payload dict."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise WSAuthError(f"Invalid token: {exc}") from exc

    if not payload.get("sub"):
        raise WSAuthError("Token missing subject")
    return payload


def require_supervisor(payload: dict) -> None:
    """Raise WSAuthError if the token does not carry a supervisor-level role."""
    role = payload.get("role", "")
    if role not in REQUIRED_SUPERVISOR_ROLES:
        raise WSAuthError(f"Role '{role}' insufficient for call monitoring")
