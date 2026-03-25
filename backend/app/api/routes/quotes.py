"""Insurance quote generation API endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_org, get_db
from app.schemas.quotes import BundleQuoteRequest, BundleQuoteResult, QuoteRequest, QuoteResult
from app.services.insurance_quotes import calculate_bundle_quotes, calculate_quote

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.post("/generate", response_model=QuoteResult)
async def generate_quote(
    body: QuoteRequest,
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
) -> QuoteResult:
    """Generate an insurance premium quote for a single coverage line.

    Supports auto, home, and life insurance types. Returns real premium
    calculations using current rate tables.
    """
    try:
        return calculate_quote(body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/bundle", response_model=BundleQuoteResult)
async def generate_bundle_quote(
    body: BundleQuoteRequest,
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
) -> BundleQuoteResult:
    """Generate quotes for multiple coverage lines with a multi-line bundle discount.

    Bundling 2+ lines applies a 10% discount per additional line (max 25%).
    """
    if not body.quotes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one quote request is required.",
        )
    try:
        return calculate_bundle_quotes(body.quotes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
