from google.adk.tools.tool_context import ToolContext
from google.genai import types  # For creating message Content/Parts


async def call_agent_async(query: str, runner, user_id, session_id):
    """Sends a query to the agent and prints the final response."""
    print(f"\n>>> User Query: {query}")

    # Prepare the user's message in ADK format
    content = types.Content(role="user", parts=[types.Part(text=query)])

    final_response_text = "Agent did not produce a final response."

    # Key Concept: run_async executes that agent logic and yields Events.
    # We iterate through events to find the final answer.
    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=content
    ):
        print(
            f"  [Event] Author: {event.author}, Type: {type(event).__name__}, Final: {event.is_final_response()}, Content: {event.content}"
        )
        # Key Concept: is_final_response() marks the concluding message for the turn.
        if event.is_final_response():
            if event.content and event.content.parts:
                # Assuming text response in the first part
                final_response_text = event.content.parts[0].text
            elif (
                event.actions and event.actions.escalate
            ):  # Handle potential errors/escalations
                final_response_text = (
                    f"Agent escalated: {event.error_message or 'No specific message.'}"
                )
            # Add more checks here if needed (e.g., specific error codes)
            break  # Stop processing events once the final response is found
    print(f"<<< Agent Response: {final_response_text}")


def get_weather_stateful(city: str, tool_context: ToolContext) -> dict:
    """Retrieves weather, converts temp unit based on session state.
    Args:
        city(str): The name of the city (e.g., "Shanghai", "Beijing")

    Returns:
        dict: A dictionary containing the weather information.
              Includes a 'status' key ('success' or 'error').
              If 'success', includes a 'report' key with weather details.
              If 'error', includes an 'error_message' key.
    """

    preferred_unit = tool_context.state.get(
        "user_preference_temperature_unit", "Celsius"
    )  # Default to Celsius
    print(
        f"--- Tool: Reading state 'user_preference_temperature_unit': {preferred_unit} ---"
    )

    city_normalized = city.lower().replace(" ", "")

    mock_weather_db = {
        "shanghai": {"temp_c": 25, "condition": "sunny"},
        "beijing": {"temp_c": 15, "condition": "cloudy"},
        "hongkong": {"temp_c": 18, "condition": "light rain"},
    }

    if city_normalized in mock_weather_db:
        data = mock_weather_db[city_normalized]
        temp_c = data["temp_c"]
        condition = data["condition"]

        if preferred_unit == "Fahrenheit":
            temp_value = (temp_c * 9 / 5) + 32
            temp_unit = "°F"
        else:
            temp_value = temp_c
            temp_unit = "°C"

        report = f"The weather in {city.capitalize()} is {condition} with a temperature of {temp_value:.0f}{temp_unit}."
        result = {"status": "success", "report": report}

        tool_context.state["last_city_checked_stateful"] = city

        return result
    else:
        # Handle city not found
        error_msg = f"Sorry, I don't have weather information for '{city}'."
        print(f"--- Tool: City '{city}' not found. ---")
        return {"status": "error", "error_message": error_msg}


def get_weather(city: str) -> dict:
    """Retrieves the current weather report for a specified city.

    Args:
        city(str): The name of the city (e.g., "Shanghai", "Beijing")

    Returns:
        dict: A dictionary containing the weather information.
              Includes a 'status' key ('success' or 'error').
              If 'success', includes a 'report' key with weather details.
              If 'error', includes an 'error_message' key.
    """
    city_normalized = city.lower().replace(" ", "")

    mock_weather_db = {
        "shanghai": {
            "status": "success",
            "report": "The weather in Shanghai is sunny with a temperature of 25°C.",
        },
        "beijing": {
            "status": "success",
            "report": "It's cloudy in Beijing with a temperature of 15°C.",
        },
        "hongkong": {
            "status": "success",
            "report": "Hong Kong is experiencing light rain and a temperature of 18°C.",
        },
    }

    if city_normalized in mock_weather_db:
        return mock_weather_db[city_normalized]
    else:
        return {
            "status": "error",
            "error_message": f"Sorry, no such weather info for {city_normalized}",
        }


def say_hello(name: str | None = None) -> str:
    """Provides a simple greetings. If a name is provided, it will be used.

    Args:
        name(str, optional): The name of the person to greet. Defaults to a generic greeting if not provided.
    Returns:
        str: A friendly greeting message.
    """
    if name:
        greeting = f"Hello, { name}!"
    else:
        greeting = "Hello there!"
    return greeting


def say_goodbye() -> str:
    """Provide a simple farewell message to conclude the conversation."""
    return "Goodbye! Have a great day."
