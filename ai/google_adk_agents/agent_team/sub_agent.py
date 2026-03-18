from cons import MODEL_GEMINI_2_5_FLASH_LITE
from google.adk.agents import Agent
from tools import say_goodbye, say_hello

greeting_agent: Agent | None = None
try:
    greeting_agent = Agent(
        model=MODEL_GEMINI_2_5_FLASH_LITE,
        name="greeting_agent",
        instruction="You are the Greeting Agent. Your ONLY task is to provide a friendly greeting to the user. "
        "Use the 'say_hello' tool to generate the greeting. "
        "If the user provides their name, make sure to pass it to the tool. "
        "Do not engage in any other conversation or tasks.",
        description="Handles simple greetings and hellos using the 'say_hello' tool.",  # Crucial for delegation
        tools=[say_hello],
    )
    print(
        f"✅ Agent '{greeting_agent.name}' created using model '{greeting_agent.model}'."
    )
except Exception as e:
    print(
        f"❌ Could not create Greeting agent. Check API Key ({MODEL_GEMINI_2_5_FLASH_LITE}). Error: {e}"
    )

farewell_agent = None
try:
    farewell_agent = Agent(
        model=MODEL_GEMINI_2_5_FLASH_LITE,
        name="farewell_agent",
        instruction="You are the Farewell Agent. Your ONLY task is to provide a polite goodbye message. "
        "Use the 'say_goodbye' tool when the user indicates they are leaving or ending the conversation "
        "(e.g., using words like 'bye', 'goodbye', 'thanks bye', 'see you'). "
        "Do not perform any other actions.",
        description="Handles simple farewells and goodbyes using the 'say_goodbye' tool.",  # Crucial for delegation
        tools=[say_goodbye],
    )
    print(
        f"✅ Agent '{farewell_agent.name}' created using model '{farewell_agent.model}'."
    )
except Exception as e:
    print(
        f"❌ Could not create Farewell agent. Check API Key ({MODEL_GEMINI_2_5_FLASH_LITE}). Error: {e}"
    )
