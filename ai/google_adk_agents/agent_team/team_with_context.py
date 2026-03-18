import asyncio

from cons import MODEL_GEMINI_2_5_FLASH
from google.adk import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from guardrail import block_keyword_guardrail, block_tool_guardrail
from load_env import load_env
from sub_agent import farewell_agent, greeting_agent
from tools import call_agent_async, get_weather_stateful

root_agent = None
runner_root = None  # Initialize runner

if greeting_agent and farewell_agent:
    root_agent_model = MODEL_GEMINI_2_5_FLASH

    root_agent_stateful = Agent(
        name="weather_agent_v2_stateful",
        model=root_agent_model,
        description="Main agent: Provides weather (state-aware unit), delegates greetings/farewells, saves report to state.",
        instruction="You are the main Weather Agent. Your job is to provide weather using 'get_weather_stateful'. "
        "The tool will format the temperature based on user preference stored in state. "
        "Delegate simple greetings to 'greeting_agent' and farewells to 'farewell_agent'. "
        "Handle only weather requests, greetings, and farewells.",
        tools=[
            get_weather_stateful
        ],  # Root agent still needs the weather tool for its core task
        # Key change: Link the sub-agents here!
        sub_agents=[greeting_agent, farewell_agent],
        before_model_callback=block_keyword_guardrail,
        before_tool_callback=block_tool_guardrail,
        output_key="last_weather_report",
    )
    print(
        f"✅ Root Agent '{root_agent_stateful.name}' created using stateful tool and output_key."
    )

else:
    print(
        "❌ Cannot create root agent because one or more sub-agents failed to initialize or 'get_weather' tool is missing."
    )
    if not greeting_agent:
        print(" - Greeting Agent is missing.")
    if not farewell_agent:
        print(" - Farewell Agent is missing.")

root_agent_var_name = "root_agent"

if root_agent_stateful:
    root_agent_var_name = "root_agent_stateful"
elif not root_agent:
    print(
        "⚠️ Root agent ('root_agent' or 'root_agent_stateful') not found. Cannot define run_team_conversation."
    )

    root_agent = None

initial_state = {"user_preference_temperature_unit": "Celsius"}
if root_agent_var_name == "root_agent_stateful":

    async def run_stateful_conversation():
        session_service_stateful = InMemorySessionService()
        APP_NAME = "tutorial_root_agent_stateful"
        USER_ID = "user_1_agent_team_stateful"
        SESSION_ID = "session_001_agent_team_stateful"
        session = await session_service_stateful.create_session(
            app_name=APP_NAME,
            user_id=USER_ID,
            session_id=SESSION_ID,
            state=initial_state,
        )

        runner_root_stateful = Runner(
            agent=root_agent_stateful,
            app_name=APP_NAME,
            session_service=session_service_stateful,
        )

        await call_agent_async(
            query="What's the weather in Shanghai",
            runner=runner_root_stateful,
            user_id=USER_ID,
            session_id=SESSION_ID,
        )
        await call_agent_async(
            query="Tell me the weather in Beijing!",
            runner=runner_root_stateful,
            user_id=USER_ID,
            session_id=SESSION_ID,
        )
        await call_agent_async(
            query="Hi!",
            runner=runner_root_stateful,
            user_id=USER_ID,
            session_id=SESSION_ID,
        )


if __name__ == "__main__":
    load_env()
    try:
        asyncio.run(run_stateful_conversation())
    except Exception as e:
        print(f"An error occurred: {e}")
