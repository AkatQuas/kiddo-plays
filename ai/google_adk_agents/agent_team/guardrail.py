from typing import Any, Dict

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext
from google.genai import types  # For creating response content


def block_keyword_guardrail(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> LlmResponse | None:
    """
    Inspects the latest user message for 'BLOCK'. If found, blocks the LLM call and returns a predefined LlmResponse. Otherwise, returns None to proceed.
    """

    agent_name = callback_context.agent_name

    last_user_message_text = ""
    if llm_request.contents:
        for content in reversed(llm_request.contents):
            if content.role == "user" and content.parts:
                if content.parts[0].text:
                    last_user_message_text = content.parts[0].text
                    break

    keyword_to_block = "BLOCK_BAD_WORD"
    if keyword_to_block in last_user_message_text.upper():
        callback_context.state["guardrail_block_keyword_triggered"] = True
        return LlmResponse(
            content=types.Content(
                role="model",
                parts=[
                    types.Part(
                        text=f"I cannot process this request because it contains the blocked keyword '{keyword_to_block}'"
                    )
                ],
            )
        )
    else:
        # Returning None to signals ADK to continue
        return None


def block_tool_guardrail(
    tool: BaseTool, args: Dict[str, Any], tool_context: ToolContext
) -> None | Dict:
    """
    Checks if 'get_weather_stateful' is called for 'Hangzhou'.
    If so, blocks the tool execution and returns a specific error dictionary.
    Otherwise, allows the tool call to proceed by returning None.
    """
    tool_name = tool.name
    agent_name = tool_context.agent_name

    target_tool_name = "get_weather_stateful"
    blocked_city = "hangzhou"

    if tool_name != target_tool_name:
        return None

    city_argument = args.get("city", "")
    if city_argument and city_argument.lower() == blocked_city:
        tool_context.state["guardrail_tool_block_triggered"] = True
        return {
            "status": "error",
            "error_message": f"Data not available for city '{city_argument}'",
        }
