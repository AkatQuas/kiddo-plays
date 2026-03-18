import asyncio

from cons import MODEL_GEMINI_2_5_FLASH
from google.adk import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from guardrail import block_keyword_guardrail
from load_env import load_env
from sub_agent import farewell_agent, greeting_agent
from tools import call_agent_async, get_weather

root_agent = None
runner_root = None  # Initialize runner

if greeting_agent and farewell_agent:
    root_agent_model = MODEL_GEMINI_2_5_FLASH

    weather_agent_team = Agent(
        name="weather_agent_v2",
        model=root_agent_model,
        description="The main coordinator agent. Handles weather requests and delegates greetings/farewells to specialists.",
        instruction="You are the main Weather Agent coordinating a team. Your primary responsibility is to provide weather information. "
        "Use the 'get_weather' tool ONLY for specific weather requests (e.g., 'weather in London'). "
        "You have specialized sub-agents: "
        "1. 'greeting_agent': Handles simple greetings like 'Hi', 'Hello'. Delegate to it for these. "
        "2. 'farewell_agent': Handles simple farewells like 'Bye', 'See you'. Delegate to it for these. "
        "Analyze the user's query. If it's a greeting, delegate to 'greeting_agent'. If it's a farewell, delegate to 'farewell_agent'. "
        "If it's a weather request, handle it yourself using 'get_weather'. "
        "For anything else, respond appropriately or state you cannot handle it.",
        tools=[
            get_weather
        ],  # Root agent still needs the weather tool for its core task
        # Key change: Link the sub-agents here!
        sub_agents=[greeting_agent, farewell_agent],
        before_model_callback=block_keyword_guardrail,
    )
    print(
        f"✅ Root Agent '{weather_agent_team.name}' created using model '{root_agent_model}' with sub-agents: {[sa.name for sa in weather_agent_team.sub_agents]}"
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

if weather_agent_team:
    root_agent_var_name = "weather_agent_team"
elif not root_agent:
    print(
        "⚠️ Root agent ('root_agent' or 'weather_agent_team') not found. Cannot define run_team_conversation."
    )

    root_agent = None

if root_agent_var_name == "weather_agent_team":

    async def run_team_conversation():
        session_service = InMemorySessionService()
        APP_NAME = "weather_tutorial_agent_team"
        USER_ID = "user_1_agent_team"
        SESSION_ID = "session_001_agent_team"
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
        )

        runner_agent_team = Runner(
            agent=weather_agent_team, app_name=APP_NAME, session_service=session_service
        )

        await call_agent_async(
            query="Hello there!",
            runner=runner_agent_team,
            user_id=USER_ID,
            session_id=SESSION_ID,
        )
        await call_agent_async(
            query="What is the weather in Shanghai!",
            runner=runner_agent_team,
            user_id=USER_ID,
            session_id=SESSION_ID,
        )
        await call_agent_async(
            query="Thanks, bye!",
            runner=runner_agent_team,
            user_id=USER_ID,
            session_id=SESSION_ID,
        )


if __name__ == "__main__":
    load_env()
    try:
        asyncio.run(run_team_conversation())
    except Exception as e:
        print(f"An error occurred: {e}")
