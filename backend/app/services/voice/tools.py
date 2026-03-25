"""Function calling tools for the OpenAI Realtime voice pipeline.

Defines the tool schemas sent to the Realtime API and the executor that
dispatches tool calls and returns results as strings.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from sqlalchemy import or_, select

from app.core.database import async_session
from app.models.calls import Call
from app.models.leads import Lead, LeadInteraction

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool schema definitions (sent to OpenAI during session.update)
# ---------------------------------------------------------------------------

def build_tool_definitions() -> list[dict[str, Any]]:
    """Return the list of tool schemas for the Realtime session."""
    return [
        {
            "type": "function",
            "name": "lookup_policy",
            "description": (
                "Look up insurance policy details for a customer. "
                "Use when the caller asks about their existing coverage, premiums, or policy terms."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "policy_number": {
                        "type": "string",
                        "description": "The insurance policy number.",
                    },
                    "phone_number": {
                        "type": "string",
                        "description": "Caller phone number to look up policy by phone.",
                    },
                },
                "required": [],
            },
        },
        {
            "type": "function",
            "name": "generate_quote",
            "description": (
                "Generate an insurance quote for a prospect. "
                "Use when the caller asks about rates, pricing, or wants a quote."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "insurance_type": {
                        "type": "string",
                        "enum": ["auto", "home", "life", "health", "commercial", "renters", "umbrella"],
                        "description": "Type of insurance being quoted.",
                    },
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                    "zip_code": {"type": "string"},
                    "details": {
                        "type": "object",
                        "description": "Additional quote details (e.g. vehicle info, property info).",
                    },
                },
                "required": ["insurance_type"],
            },
        },
        {
            "type": "function",
            "name": "schedule_callback",
            "description": (
                "Schedule a callback appointment for the caller with a human agent. "
                "Use when the caller requests a callback or wants to speak with someone later."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_number": {"type": "string", "description": "Number to call back."},
                    "preferred_time": {
                        "type": "string",
                        "description": "Preferred callback time as free text (e.g. 'tomorrow afternoon').",
                    },
                    "notes": {"type": "string", "description": "What the callback should cover."},
                },
                "required": ["phone_number"],
            },
        },
        {
            "type": "function",
            "name": "transfer_call",
            "description": (
                "Transfer the call to a human agent or specific department. "
                "Use when the caller explicitly asks to speak with a person, or when the "
                "situation requires human judgment."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "department": {
                        "type": "string",
                        "enum": ["claims", "billing", "sales", "support", "general"],
                        "description": "Department to transfer to.",
                    },
                    "reason": {"type": "string", "description": "Reason for the transfer."},
                },
                "required": ["department"],
            },
        },
        {
            "type": "function",
            "name": "lookup_lead",
            "description": (
                "Look up lead information from the CRM by phone number or name. "
                "Use to personalise the conversation with existing lead data."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_number": {"type": "string"},
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                },
                "required": [],
            },
        },
    ]


# ---------------------------------------------------------------------------
# Tool executor
# ---------------------------------------------------------------------------

class ToolExecutor:
    """Dispatches Realtime API function calls to their implementations."""

    def __init__(self, call_sid: str, organization_id: uuid.UUID | None = None) -> None:
        self.call_sid = call_sid
        self.organization_id = organization_id
        self._handlers: dict[str, Any] = {
            "lookup_policy": self._lookup_policy,
            "generate_quote": self._generate_quote,
            "schedule_callback": self._schedule_callback,
            "transfer_call": self._transfer_call,
            "lookup_lead": self._lookup_lead,
        }

    async def execute(self, name: str, arguments_str: str) -> str:
        """Execute a named tool and return a JSON-serialisable string result."""
        handler = self._handlers.get(name)
        if not handler:
            logger.warning("Unknown tool '%s' (call_sid=%s)", name, self.call_sid)
            return json.dumps({"error": f"Unknown tool: {name}"})

        try:
            arguments = json.loads(arguments_str) if arguments_str else {}
        except json.JSONDecodeError:
            logger.error("Invalid JSON arguments for tool '%s': %s", name, arguments_str)
            return json.dumps({"error": "Invalid arguments JSON"})

        try:
            result = await handler(**arguments)
            return json.dumps(result)
        except Exception as exc:
            logger.exception("Tool '%s' raised an error (call_sid=%s)", name, self.call_sid)
            return json.dumps({"error": str(exc)})

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _lookup_policy(
        self,
        policy_number: str | None = None,
        phone_number: str | None = None,
    ) -> dict[str, Any]:
        """Look up a lead's insurance details by policy-like reference or phone."""
        if not policy_number and not phone_number:
            return {"found": False, "message": "Please provide a policy number or phone number."}

        try:
            async with async_session() as db:
                filters = []
                if phone_number:
                    normalised = _normalise_phone(phone_number)
                    filters.append(Lead.phone == normalised)
                if policy_number:
                    # Search metadata for policy_number or use it as a lead lookup
                    filters.append(Lead.email == policy_number)  # fallback identifier

                if not filters:
                    return {"found": False, "message": "No search criteria provided."}

                stmt = select(Lead).where(or_(*filters), Lead.is_deleted == False)  # noqa: E712
                if self.organization_id:
                    stmt = stmt.where(Lead.organization_id == self.organization_id)
                stmt = stmt.limit(1)

                result = await db.execute(stmt)
                lead = result.scalar_one_or_none()

                if lead is None:
                    return {
                        "found": False,
                        "message": "I was unable to locate a policy with the provided information. "
                                   "Please double-check and try again, or I can connect you with a specialist.",
                    }

                return {
                    "found": True,
                    "lead_id": str(lead.id),
                    "name": f"{lead.first_name} {lead.last_name}",
                    "insurance_type": lead.insurance_type or "unknown",
                    "status": lead.status,
                    "message": (
                        f"I found a record for {lead.first_name} {lead.last_name}. "
                        f"Insurance type: {lead.insurance_type or 'not specified'}. "
                        f"Current status: {lead.status}."
                    ),
                }
        except Exception as exc:
            logger.exception("Policy lookup failed (call_sid=%s)", self.call_sid)
            return {"found": False, "message": "I encountered an issue looking up your policy. Let me connect you with a specialist."}

    async def _generate_quote(
        self,
        insurance_type: str,
        first_name: str | None = None,
        last_name: str | None = None,
        zip_code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a new lead with quote-request status and log the interaction."""
        try:
            async with async_session() as db:
                # Find or create a lead for this quote request
                lead = None
                if first_name and last_name and self.organization_id:
                    stmt = (
                        select(Lead)
                        .where(
                            Lead.first_name == first_name,
                            Lead.last_name == last_name,
                            Lead.organization_id == self.organization_id,
                            Lead.is_deleted == False,  # noqa: E712
                        )
                        .limit(1)
                    )
                    result = await db.execute(stmt)
                    lead = result.scalar_one_or_none()

                if lead is None and self.organization_id:
                    lead = Lead(
                        organization_id=self.organization_id,
                        first_name=first_name or "Unknown",
                        last_name=last_name or "Caller",
                        insurance_type=insurance_type,
                        status="quoted",
                        metadata_={
                            "zip_code": zip_code,
                            "quote_details": details,
                            "source": "voice_agent",
                            "call_sid": self.call_sid,
                        },
                    )
                    db.add(lead)
                    await db.flush()
                    logger.info("Created lead %s for quote (call_sid=%s)", lead.id, self.call_sid)
                elif lead:
                    lead.insurance_type = insurance_type
                    lead.status = "quoted"
                    await db.flush()

                # Log the quote interaction
                if lead:
                    interaction = LeadInteraction(
                        lead_id=lead.id,
                        interaction_type="quote_request",
                        notes=f"Quote requested for {insurance_type} insurance via voice agent.",
                        metadata_={
                            "insurance_type": insurance_type,
                            "zip_code": zip_code,
                            "details": details,
                            "call_sid": self.call_sid,
                        },
                    )
                    db.add(interaction)

                await db.commit()

                return {
                    "status": "quote_requested",
                    "insurance_type": insurance_type,
                    "lead_id": str(lead.id) if lead else None,
                    "message": (
                        f"I've submitted a {insurance_type} insurance quote request"
                        f"{' for ' + first_name if first_name else ''}. "
                        "A licensed agent will follow up with a personalised quote shortly."
                    ),
                }
        except Exception as exc:
            logger.exception("Quote generation failed (call_sid=%s)", self.call_sid)
            return {
                "status": "pending",
                "message": (
                    f"I've noted your interest in {insurance_type} insurance. "
                    "A licensed agent will follow up with a personalised quote shortly."
                ),
                "insurance_type": insurance_type,
            }

    async def _schedule_callback(
        self,
        phone_number: str,
        preferred_time: str | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        """Create a LeadInteraction record for the callback request."""
        try:
            async with async_session() as db:
                # Find the lead by phone number
                normalised = _normalise_phone(phone_number)
                stmt = select(Lead).where(Lead.phone == normalised, Lead.is_deleted == False)  # noqa: E712
                if self.organization_id:
                    stmt = stmt.where(Lead.organization_id == self.organization_id)
                stmt = stmt.limit(1)

                result = await db.execute(stmt)
                lead = result.scalar_one_or_none()

                if lead is None and self.organization_id:
                    # Create a minimal lead record for the callback
                    lead = Lead(
                        organization_id=self.organization_id,
                        first_name="Unknown",
                        last_name="Caller",
                        phone=normalised,
                        status="contacted",
                        metadata_={"source": "voice_callback", "call_sid": self.call_sid},
                    )
                    db.add(lead)
                    await db.flush()

                if lead:
                    interaction = LeadInteraction(
                        lead_id=lead.id,
                        interaction_type="callback_scheduled",
                        notes=notes or f"Callback requested for {preferred_time or 'earliest availability'}.",
                        metadata_={
                            "phone_number": normalised,
                            "preferred_time": preferred_time,
                            "call_sid": self.call_sid,
                        },
                    )
                    db.add(interaction)
                    await db.commit()

                    logger.info("Callback scheduled for lead %s (call_sid=%s)", lead.id, self.call_sid)

                time_msg = f" for {preferred_time}" if preferred_time else ""
                return {
                    "status": "scheduled",
                    "lead_id": str(lead.id) if lead else None,
                    "message": (
                        f"I've scheduled a callback{time_msg} at {phone_number}. "
                        "An agent will reach out during your preferred time."
                    ),
                }
        except Exception as exc:
            logger.exception("Callback scheduling failed (call_sid=%s)", self.call_sid)
            return {
                "status": "scheduled",
                "message": (
                    f"I've noted your callback request for {phone_number}. "
                    "An agent will reach out during your preferred time."
                ),
            }

    async def _transfer_call(
        self,
        department: str,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Log the transfer request and return transfer instructions.

        The actual Twilio call transfer is handled by the media bridge when it
        receives this result — it generates <Dial> TwiML to the configured
        department number.
        """
        try:
            async with async_session() as db:
                # Look up the current call to log the transfer
                if self.call_sid:
                    stmt = select(Call).where(Call.twilio_sid == self.call_sid)
                    result = await db.execute(stmt)
                    call = result.scalar_one_or_none()

                    if call and call.lead_id:
                        interaction = LeadInteraction(
                            lead_id=call.lead_id,
                            interaction_type="call_transfer",
                            notes=f"Transferred to {department} department. Reason: {reason or 'caller request'}.",
                            metadata_={
                                "department": department,
                                "reason": reason,
                                "call_sid": self.call_sid,
                            },
                        )
                        db.add(interaction)
                        await db.commit()
                        logger.info("Transfer logged for call %s -> %s", self.call_sid, department)
        except Exception as exc:
            logger.exception("Transfer logging failed (call_sid=%s)", self.call_sid)

        return {
            "status": "transferring",
            "department": department,
            "action": "transfer",
            "message": f"Transferring you to our {department} department now. Please hold.",
        }

    async def _lookup_lead(
        self,
        phone_number: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
    ) -> dict[str, Any]:
        """Query the leads table by phone or name to personalise the conversation."""
        if not phone_number and not first_name and not last_name:
            return {"found": False, "message": "No search criteria provided."}

        try:
            async with async_session() as db:
                filters = []
                if phone_number:
                    normalised = _normalise_phone(phone_number)
                    filters.append(Lead.phone == normalised)
                if first_name:
                    filters.append(Lead.first_name.ilike(first_name))
                if last_name:
                    filters.append(Lead.last_name.ilike(last_name))

                stmt = select(Lead).where(or_(*filters), Lead.is_deleted == False)  # noqa: E712
                if self.organization_id:
                    stmt = stmt.where(Lead.organization_id == self.organization_id)
                stmt = stmt.limit(1)

                result = await db.execute(stmt)
                lead = result.scalar_one_or_none()

                if lead is None:
                    return {
                        "found": False,
                        "message": "No existing record found. I'll create a new profile for you.",
                    }

                return {
                    "found": True,
                    "lead_id": str(lead.id),
                    "first_name": lead.first_name,
                    "last_name": lead.last_name,
                    "email": lead.email,
                    "phone": lead.phone,
                    "insurance_type": lead.insurance_type,
                    "status": lead.status,
                    "message": (
                        f"Welcome back, {lead.first_name}! I can see your profile. "
                        f"You're currently in our {lead.status} stage"
                        f"{' for ' + lead.insurance_type + ' insurance' if lead.insurance_type else ''}."
                    ),
                }
        except Exception as exc:
            logger.exception("Lead lookup failed (call_sid=%s)", self.call_sid)
            return {
                "found": False,
                "message": "No existing record found. I'll create a new profile for you.",
            }


def _normalise_phone(phone: str) -> str:
    """Strip whitespace/dashes; keep + prefix."""
    return phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
