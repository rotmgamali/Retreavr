"""
Onboarding API — saves setup wizard data and tracks completion.

Onboarding state is stored in Organization.settings["onboarding"].
"""

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.organization import Organization
from app.models.user import User
from app.models.voice_agents import VoiceAgent

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingData(BaseModel):
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_website: Optional[str] = None
    license_number: Optional[str] = None
    insurance_types: Optional[list[str]] = None
    agent_name: Optional[str] = None
    agent_voice: Optional[str] = None
    agent_greeting: Optional[str] = None
    phone_number: Optional[str] = None
    phone_provider: Optional[str] = None
    request_new_number: Optional[bool] = None
    inbound_number: Optional[str] = None
    request_outbound_number: Optional[bool] = None


@router.get("/status")
async def get_onboarding_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    org = await db.get(Organization, current_user.organization_id)
    settings = org.settings or {} if org else {}
    onboarding = settings.get("onboarding", {})

    return {
        "onboarding_completed": settings.get("onboarding_completed", False),
        "current_step": onboarding.get("current_step", 0),
        "org_setup": bool(onboarding.get("company_name")),
        "agent_configured": bool(onboarding.get("agent_name")),
        "phone_provisioned": bool(onboarding.get("phone_option")),
        "first_campaign": False,
        "organization_name": org.name if org else "",
        "insurance_types": onboarding.get("insurance_types", []),
    }


@router.post("/")
async def save_onboarding(
    body: OnboardingData,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    org = await db.get(Organization, current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    settings: dict[str, Any] = dict(org.settings or {})
    onboarding_data = body.model_dump(exclude_unset=True)

    settings["onboarding"] = {**settings.get("onboarding", {}), **onboarding_data}
    settings["onboarding_completed"] = True

    if body.company_name and body.company_name != org.name:
        org.name = body.company_name

    if body.insurance_types:
        settings["insurance_types"] = body.insurance_types

    org.settings = settings
    await db.flush()

    # Create the voice agent if provided — only admin/superadmin may do this
    if body.agent_name:
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(
                status_code=403,
                detail="Only admin or superadmin users can create voice agents during onboarding",
            )

        insurance_context = ""
        if body.insurance_types:
            insurance_context = f" You specialize in {', '.join(body.insurance_types)} insurance."

        greeting = body.agent_greeting or f"Hello, thank you for calling {org.name}. How can I help you today?"
        system_prompt = (
            f"You are {body.agent_name}, a professional insurance agent for {org.name}.{insurance_context} "
            f"Be helpful, knowledgeable, and friendly. Start calls with: '{greeting}'"
        )

        agent = VoiceAgent(
            organization_id=org.id,
            name=body.agent_name,
            system_prompt=system_prompt,
            voice=body.agent_voice or "alloy",
            status="active",
        )
        db.add(agent)
        await db.flush()

    await db.commit()
    await db.refresh(org)
    return {"success": True, "onboarding_completed": True}
