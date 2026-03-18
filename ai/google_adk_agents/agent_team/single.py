import asyncio
import os
import warnings

from cons import MODEL_GEMINI_2_5_FLASH
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm  # For multi-model support
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from load_env import load_env
from tools import call_agent_async, get_weather

warnings.filterwarnings("ignore")

import logging

logging.basicConfig(level=logging.ERROR)

# Use one of the model constants defined earlier
AGENT_MODEL = MODEL_GEMINI_2_5_FLASH  # Starting with Gemini

weather_agent = Agent(
    name="weather_agent_v1",
    model=AGENT_MODEL,  # Can be a string for Gemini or a LiteLlm object
    description="Provides weather information for specific cities.",
    instruction="You are a helpful weather assistant. "
    "When the user asks for the weather in a specific city, "
    "use the 'get_weather' tool to find the information. "
    "If the tool returns an error, inform the user politely. "
    "If the tool is successful, present the weather report clearly.",
    tools=[get_weather],  # Pass the function directly
)
# --- Session Management ---
# Key Concept: SessionService stores conversation history & state.
# InMemorySessionService is simple, non-persistent storage for this file.
session_service = InMemorySessionService()

# Define constants for identifying the interaction context
APP_NAME = "weather_tutorial_app"
USER_ID = "user_jack"
SESSION_ID = "session_001"


# --- Runner ---
# Key Concept: Runner orchestrates the agent execution loop


async def run_conversation():
    session = await session_service.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
    )
    runner = Runner(
        agent=weather_agent, app_name=APP_NAME, session_service=session_service
    )
    await call_agent_async(
        "What is the weather like in Shanghai?",
        runner=runner,
        user_id=USER_ID,
        session_id=SESSION_ID,
    )
    await call_agent_async(
        "How about Shenzhen?",
        runner=runner,
        user_id=USER_ID,
        session_id=SESSION_ID,
    )
    await call_agent_async(
        "Tell me the weather in Beijing?",
        runner=runner,
        user_id=USER_ID,
        session_id=SESSION_ID,
    )


if __name__ == "__main__":
    load_env()
    try:
        asyncio.run(run_conversation())
    except Exception as e:
        print(f"An error occurred: {e}")
