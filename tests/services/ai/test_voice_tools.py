"""Unit tests for voice agent tool definitions."""

import pytest

from app.services.ai.voice_tools import VOICE_AGENT_TOOLS, get_openai_tool_definitions


EXPECTED_TOOLS = {"lookup_policy", "generate_quote", "schedule_callback", "transfer_call"}


def test_all_required_tools_defined():
    names = {t.name for t in VOICE_AGENT_TOOLS}
    assert names == EXPECTED_TOOLS


def test_each_tool_has_description():
    for tool in VOICE_AGENT_TOOLS:
        assert tool.description, f"{tool.name} missing description"


def test_each_tool_has_parameters_object():
    for tool in VOICE_AGENT_TOOLS:
        assert isinstance(tool.parameters, dict), f"{tool.name} parameters must be a dict"
        assert tool.parameters.get("type") == "object", f"{tool.name} parameters.type must be 'object'"
        assert "properties" in tool.parameters, f"{tool.name} missing properties"


def test_required_fields_for_generate_quote():
    tool = next(t for t in VOICE_AGENT_TOOLS if t.name == "generate_quote")
    assert "required" in tool.parameters
    assert "insurance_type" in tool.parameters["required"]


def test_required_fields_for_schedule_callback():
    tool = next(t for t in VOICE_AGENT_TOOLS if t.name == "schedule_callback")
    required = tool.parameters.get("required", [])
    assert "customer_name" in required
    assert "phone_number" in required


def test_required_fields_for_transfer_call():
    tool = next(t for t in VOICE_AGENT_TOOLS if t.name == "transfer_call")
    required = tool.parameters.get("required", [])
    assert "department" in required
    assert "reason" in required


def test_get_openai_tool_definitions_format():
    defs = get_openai_tool_definitions()
    assert len(defs) == len(VOICE_AGENT_TOOLS)
    for d in defs:
        assert d["type"] == "function"
        assert "name" in d
        assert "description" in d
        assert "parameters" in d


def test_generate_quote_insurance_types():
    tool = next(t for t in VOICE_AGENT_TOOLS if t.name == "generate_quote")
    insurance_type_prop = tool.parameters["properties"]["insurance_type"]
    assert "enum" in insurance_type_prop
    assert set(insurance_type_prop["enum"]) >= {"auto", "home", "life"}


def test_transfer_call_departments():
    tool = next(t for t in VOICE_AGENT_TOOLS if t.name == "transfer_call")
    dept_prop = tool.parameters["properties"]["department"]
    assert "enum" in dept_prop
    assert "sales" in dept_prop["enum"]
    assert "claims" in dept_prop["enum"]


def test_all_tools_have_handlers():
    for tool in VOICE_AGENT_TOOLS:
        assert tool.handler, f"{tool.name} missing handler path"
        assert tool.handler.startswith("app."), f"{tool.name} handler should be a dotted module path"
