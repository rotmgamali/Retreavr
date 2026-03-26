"""
Redis client factory and utilities.

Used for:
- Rate limiting (outbound calls)
- Event bus pub/sub (multi-instance support)
- Campaign job queue
"""
from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: Optional[aioredis.Redis] = None


async def get_redis() -> Optional[aioredis.Redis]:
    """Return a shared async Redis connection, or None if not configured."""
    global _pool
    settings = get_settings()
    if not settings.redis_url:
        return None
    if _pool is None:
        _pool = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )
    return _pool


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


# ── Rate-limiter (sliding window counter) ─────────────────────────────

async def check_rate_limit_redis(
    org_id: str,
    window_seconds: int = 60,
    max_calls: int = 10,
) -> bool:
    """
    Redis-backed sliding-window rate limiter.
    Returns True if within limits, False if exceeded.
    Fail-closed: returns False (deny) when Redis is unavailable.
    """
    r = await get_redis()
    if r is None:
        logger.warning("Redis unavailable – denying outbound call (fail-closed)")
        return False  # no Redis → deny (fail-closed)

    import time
    key = f"ratelimit:outbound:{org_id}"
    now = time.time()
    window_start = now - window_seconds

    try:
        pipe = r.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, window_seconds + 1)
        results = await pipe.execute()
    except Exception:
        logger.warning("Redis error during outbound rate limit check – denying (fail-closed)")
        return False  # Redis error → deny (fail-closed)

    current_count = results[1]
    return current_count < max_calls


async def check_admin_rate_limit(
    ip: str,
    window_seconds: int = 60,
    max_calls: int = 60,
) -> bool:
    """
    IP-based sliding-window rate limiter for admin endpoints.
    60 requests per minute per IP by default.
    Falls back to allowing the call if Redis is unavailable.
    """
    r = await get_redis()
    if r is None:
        return True  # no Redis → skip rate limiting

    import time
    key = f"ratelimit:admin:{ip}"
    now = time.time()
    window_start = now - window_seconds

    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zcard(key)
    pipe.zadd(key, {str(now): now})
    pipe.expire(key, window_seconds + 1)
    results = await pipe.execute()

    current_count = results[1]
    return current_count < max_calls

async def check_auth_rate_limit(
    ip: str,
    action: str,
    window_seconds: int = 60,
    max_calls: int = 5,
) -> bool:
    """
    IP-based sliding-window rate limiter for auth endpoints.
    Returns True if within limits, False if exceeded.
    Fail-closed: returns False (deny) when Redis is unavailable,
    because auth endpoints must always be rate-limited.
    """
    r = await get_redis()
    if r is None:
        logger.warning("Redis unavailable – denying auth request (fail-closed)")
        return False  # no Redis → deny (fail-closed for auth)

    import time
    key = f"ratelimit:auth:{action}:{ip}"
    now = time.time()
    window_start = now - window_seconds

    try:
        pipe = r.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, window_seconds + 1)
        results = await pipe.execute()
    except Exception:
        logger.warning("Redis error during auth rate limit check – denying (fail-closed)")
        return False  # Redis error → deny (fail-closed for auth)

    current_count = results[1]
    return current_count < max_calls
