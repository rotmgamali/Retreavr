import csv
import hashlib
import io
import re
import secrets
import uuid
from typing import Annotated, Any, Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_org, get_db, require_role
from app.models.organization import Organization
from app.models.system import AuditLog, ApiKey, Integration, NotificationRule
from app.models.user import User
from app.services.audit import log_audit_event

router = APIRouter(prefix="/settings", tags=["settings"])

# Max DNC file size: 5 MB
_DNC_MAX_BYTES = 5 * 1024 * 1024


# --- Pydantic schemas ---

class OrgSettingsUpdate(BaseModel):
    name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    subscription_tier: Optional[str] = None


class IntegrationCreate(BaseModel):
    name: str
    provider: str
    config: Optional[Dict[str, Any]] = None
    credentials: Optional[Dict[str, Any]] = None


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    credentials: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class IntegrationResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider: str
    config: Optional[Dict[str, Any]] = None
    is_active: bool

    model_config = {"from_attributes": True}


class NotificationRuleCreate(BaseModel):
    name: str
    trigger_event: str
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None


class NotificationRuleUpdate(BaseModel):
    name: Optional[str] = None
    trigger_event: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class NotificationRuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    trigger_event: str
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None
    is_active: bool

    model_config = {"from_attributes": True}


# --- Organization settings ---

@router.get("/organization")
async def get_org_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "settings": org.settings,
        "subscription_tier": org.subscription_tier,
    }


@router.patch("/organization")
async def update_org_settings(
    body: OrgSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    current_user: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    updates = body.model_dump(exclude_unset=True)
    # Only superadmins may change subscription_tier
    if current_user.role != "superadmin":
        updates.pop("subscription_tier", None)

    allowed = {"name", "settings", "subscription_tier"}
    for field, value in updates.items():
        if field in allowed:
            setattr(org, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(org)
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "settings": org.settings,
        "subscription_tier": org.subscription_tier,
    }


# --- Integrations ---

@router.get("/integrations", response_model=list[IntegrationResponse])
async def list_integrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    result = await db.execute(
        select(Integration).where(Integration.organization_id == org_id)
    )
    return result.scalars().all()


@router.post("/integrations", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    body: IntegrationCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    current_user: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    integration = Integration(**body.model_dump(), organization_id=org_id)
    db.add(integration)
    await db.flush()
    await log_audit_event(
        db, org_id, current_user.id,
        action="integration.created",
        resource_type="integration",
        resource_id=str(integration.id),
        details={"name": integration.name, "provider": integration.provider},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(integration)
    return integration


@router.patch("/integrations/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: uuid.UUID,
    body: IntegrationUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    current_user: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    integration = await db.get(Integration, integration_id)
    if not integration or integration.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

    INTEGRATION_UPDATE_FIELDS = {"name", "config", "credentials", "is_active"}
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field in INTEGRATION_UPDATE_FIELDS:
            setattr(integration, field, value)

    await db.flush()
    await log_audit_event(
        db, org_id, current_user.id,
        action="integration.updated",
        resource_type="integration",
        resource_id=str(integration.id),
        details={"name": integration.name, "fields_updated": list(updates.keys())},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(integration)
    return integration


# --- Notification rules ---

@router.get("/notifications", response_model=list[NotificationRuleResponse])
async def list_notification_rules(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    result = await db.execute(
        select(NotificationRule).where(NotificationRule.organization_id == org_id)
    )
    return result.scalars().all()


@router.post("/notifications", response_model=NotificationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_notification_rule(
    body: NotificationRuleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    rule = NotificationRule(**body.model_dump(), organization_id=org_id)
    db.add(rule)
    await db.flush()
    await db.commit()
    await db.refresh(rule)
    return rule


@router.patch("/notifications/{rule_id}", response_model=NotificationRuleResponse)
async def update_notification_rule(
    rule_id: uuid.UUID,
    body: NotificationRuleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    rule = await db.get(NotificationRule, rule_id)
    if not rule or rule.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification rule not found")

    NOTIFICATION_RULE_UPDATE_FIELDS = {"name", "trigger_event", "conditions", "actions", "is_active"}
    for field, value in body.model_dump(exclude_unset=True).items():
        if field in NOTIFICATION_RULE_UPDATE_FIELDS:
            setattr(rule, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(rule)
    return rule


# --- DNC list management ---

def _normalise_phone(raw: str) -> str:
    """Strip a phone string down to digits with optional leading +."""
    return re.sub(r"[^\d+]", "", raw.strip())


@router.post("/dnc/upload")
async def upload_dnc_csv(
    file: Annotated[UploadFile, File(description="CSV file with phone numbers")],
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    current_user: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    """
    Upload a .csv file to populate the organisation's DNC (Do Not Call) list.
    The CSV should have a column named 'phone' (or the first column is used).
    Numbers are normalised and de-duplicated.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .csv files are accepted")

    raw = await file.read()
    if len(raw) > _DNC_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 5 MB)")

    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    fieldnames = reader.fieldnames or []
    phone_col = None
    for name in fieldnames:
        if name.lower().strip() in ("phone", "phone_number", "phonenumber", "number", "tel", "telephone"):
            phone_col = name
            break
    if phone_col is None and fieldnames:
        phone_col = fieldnames[0]

    if phone_col is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV has no columns")

    numbers: set[str] = set()
    for row in reader:
        normalised = _normalise_phone(row.get(phone_col, ""))
        if len(normalised) >= 7:
            numbers.add(normalised)

    if not numbers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid phone numbers found in CSV")

    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    current_settings: dict = org.settings or {}
    existing_dnc: list = current_settings.get("dnc_list", [])
    merged = list(set(existing_dnc) | numbers)

    current_settings["dnc_list"] = merged
    org.settings = current_settings
    await db.flush()
    await log_audit_event(
        db, org_id, current_user.id,
        action="dnc.uploaded",
        resource_type="dnc_list",
        details={"uploaded": len(numbers), "new_added": len(merged) - len(existing_dnc), "total": len(merged)},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {
        "uploaded": len(numbers),
        "total_dnc": len(merged),
        "previously_existing": len(existing_dnc),
        "new_added": len(merged) - len(existing_dnc),
    }


@router.get("/dnc")
async def get_dnc_list(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    """Return the current DNC list for the organisation."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    dnc_list = (org.settings or {}).get("dnc_list", [])
    return {"total": len(dnc_list), "numbers": dnc_list}


@router.delete("/dnc")
async def clear_dnc_list(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    current_user: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    """Clear the entire DNC list for the organisation."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    current_settings: dict = org.settings or {}
    current_settings["dnc_list"] = []
    org.settings = current_settings
    await db.flush()
    await log_audit_event(
        db, org_id, current_user.id,
        action="dnc.cleared",
        resource_type="dnc_list",
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {"status": "cleared"}


# --- Pydantic schemas for API keys ---

class ApiKeyCreate(BaseModel):
    name: str

class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    is_active: bool
    last_used_at: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}

class ApiKeyCreatedResponse(ApiKeyResponse):
    """Returned only on creation - includes the full key (shown once)."""
    full_key: str


# --- API Key endpoints ---

@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.organization_id == org_id).order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: ApiKeyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    raw_key = f"ret_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12]

    api_key = ApiKey(
        organization_id=org_id,
        name=body.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db.add(api_key)
    await db.flush()
    await db.commit()
    await db.refresh(api_key)

    # Return the full key only this one time
    response = ApiKeyCreatedResponse.model_validate(api_key)
    response.full_key = raw_key
    return response


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    key = await db.get(ApiKey, key_id)
    if not key or key.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    key.is_active = False
    await db.flush()
    await db.commit()
    return {"status": "revoked"}


# --- Audit log ---

class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/audit-logs")
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
    limit: int = 50,
    offset: int = 0,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
):
    query = select(AuditLog).where(AuditLog.organization_id == org_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = result.scalars().all()

    return {"items": items, "total": total, "limit": limit, "offset": offset}
