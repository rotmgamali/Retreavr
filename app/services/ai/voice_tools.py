from __future__ import annotations

"""Voice agent conversation function/tool definitions for OpenAI Realtime API."""

from app.models.ai_schemas import VoiceToolDefinition

VOICE_AGENT_TOOLS: list[VoiceToolDefinition] = [
    VoiceToolDefinition(
        name="lookup_policy",
        description="Look up an existing insurance policy by policy number, customer name, or phone number. Use when the caller references an existing policy or wants to check their current coverage.",
        parameters={
            "type": "object",
            "properties": {
                "policy_number": {
                    "type": "string",
                    "description": "The policy number to look up",
                },
                "customer_name": {
                    "type": "string",
                    "description": "Customer's full name for fuzzy matching",
                },
                "phone_number": {
                    "type": "string",
                    "description": "Customer's phone number",
                },
            },
        },
        handler="app.services.ai.tool_handlers.handle_lookup_policy",
    ),
    VoiceToolDefinition(
        name="generate_quote",
        description="Generate an insurance quote based on collected customer information. Use after gathering sufficient data about the customer's insurance needs.",
        parameters={
            "type": "object",
            "properties": {
                "insurance_type": {
                    "type": "string",
                    "enum": ["auto", "home", "life"],
                    "description": "Type of insurance quote to generate",
                },
                "age": {"type": "integer", "description": "Customer's age"},
                "zip_code": {"type": "string", "description": "Customer's ZIP code"},
                "coverage_amount": {"type": "number", "description": "Desired coverage amount"},
                "deductible": {"type": "number", "description": "Desired deductible amount"},
                "driving_record": {
                    "type": "string",
                    "enum": ["clean", "minor_violations", "major_violations"],
                    "description": "Driving record (auto only)",
                },
                "tobacco_status": {"type": "boolean", "description": "Tobacco user (life only)"},
                "property_value": {"type": "number", "description": "Property value (home only)"},
            },
            "required": ["insurance_type"],
        },
        handler="app.services.ai.tool_handlers.handle_generate_quote",
    ),
    VoiceToolDefinition(
        name="schedule_callback",
        description="Schedule a callback for the customer at their preferred date and time. Use when the customer wants to continue the conversation later or needs time to gather information.",
        parameters={
            "type": "object",
            "properties": {
                "customer_name": {
                    "type": "string",
                    "description": "Customer's name",
                },
                "phone_number": {
                    "type": "string",
                    "description": "Phone number to call back",
                },
                "preferred_date": {
                    "type": "string",
                    "description": "Preferred callback date (YYYY-MM-DD)",
                },
                "preferred_time": {
                    "type": "string",
                    "description": "Preferred callback time (HH:MM)",
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for callback",
                },
            },
            "required": ["customer_name", "phone_number"],
        },
        handler="app.services.ai.tool_handlers.handle_schedule_callback",
    ),
    VoiceToolDefinition(
        name="transfer_call",
        description="Transfer the call to a human agent or specialist. Use when the customer explicitly requests a human, the conversation requires expertise beyond the AI agent's scope, or a complex claim needs handling.",
        parameters={
            "type": "object",
            "properties": {
                "department": {
                    "type": "string",
                    "enum": ["sales", "claims", "billing", "technical_support", "supervisor"],
                    "description": "Department to transfer to",
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for the transfer",
                },
                "priority": {
                    "type": "string",
                    "enum": ["normal", "urgent"],
                    "description": "Transfer priority level",
                },
            },
            "required": ["department", "reason"],
        },
        handler="app.services.ai.tool_handlers.handle_transfer_call",
    ),
]


def get_openai_tool_definitions() -> list[dict]:
    """Convert voice tools to OpenAI function calling format."""
    return [
        {
            "type": "function",
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.parameters,
        }
        for tool in VOICE_AGENT_TOOLS
    ]
