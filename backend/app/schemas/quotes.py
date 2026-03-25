from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class QuoteRequest(BaseModel):
    insurance_type: str  # auto, home, life
    age: Optional[int] = None
    zip_code: Optional[str] = None
    coverage_amount: Optional[float] = None
    deductible: Optional[float] = None
    # Auto-specific
    driving_record: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_type: Optional[str] = None
    # Home-specific
    property_value: Optional[float] = None
    construction_type: Optional[str] = None
    home_age: Optional[int] = None
    claims_history: Optional[int] = None
    # Life-specific
    gender: Optional[str] = None
    tobacco_status: Optional[bool] = None
    health_class: Optional[str] = None
    term_years: Optional[int] = None


class PremiumBreakdown(BaseModel):
    base_premium: float
    adjustments: dict[str, float]
    discounts: dict[str, float]
    total_premium: float


class QuoteResult(BaseModel):
    insurance_type: str
    monthly_premium: float
    annual_premium: float
    breakdown: PremiumBreakdown
    coverage_details: dict[str, str]
    rate_table_version: str


class BundleQuoteRequest(BaseModel):
    quotes: list[QuoteRequest]


class BundleQuoteResult(BaseModel):
    quotes: list[QuoteResult]
    total_monthly: float
    total_annual: float
    bundle_savings_annual: float
