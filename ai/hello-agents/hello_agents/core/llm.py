"""HelloAgents Unified LLM interface - OpenAI, Anthropic, Gemini and more"""

import asyncio
import os
from typing import AsyncIterator, Dict, Iterator, List, Optional, Union

from .exceptions import HelloAgentsException
from .llm_adapters import BaseLLMAdapter, create_adapter
from .llm_response import LLMResponse, LLMToolResponse, StreamStats


class HelloAgentsLLM:
    """
    HelloAgents Unified LLM Client

    Design Philosophy:
    - Unified Configuration: Only requires LLM_MODEL_ID, LLM_API_KEY, LLM_BASE_URL, LLM_TIMEOUT
    - Automatic Adapter Selection: Automatically selects adapter (OpenAI/Anthropic/Gemini) based on base_url
    - Statistics: Returns token usage, latency, and other metrics for logging
    - Thinking Model Support: Automatically detects and handles reasoning processes (o1, deepseek-reasoner, etc.)

    Supported Interfaces:
    - OpenAI and all compatible interfaces (DeepSeek, Qwen, Kimi, Zhipu, Ollama, etc.)
    - Anthropic Claude
    - Google Gemini
    """

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        timeout: Optional[int] = None,
        **kwargs
    ):
        """
        Initialize LLM Client

        Parameter Priority: passed arguments > environment variables

        Args:
            model: Model name, default read from LLM_MODEL_ID
            api_key: API key, default read from LLM_API_KEY
            base_url: Service URL, default read from LLM_BASE_URL
            temperature: Temperature parameter, default 0.7
            max_tokens: Maximum tokens
            timeout: Timeout in seconds, default read from LLM_TIMEOUT, default 60 seconds
        """
        # Load configuration
        self.model = model or os.getenv("LLM_MODEL_ID")
        self.api_key = api_key or os.getenv("LLM_API_KEY")
        self.base_url = base_url or os.getenv("LLM_BASE_URL")
        self.timeout = timeout or int(os.getenv("LLM_TIMEOUT", "60"))

        self.temperature = temperature
        self.max_tokens = max_tokens
        self.kwargs = kwargs

        # Validate required parameters
        if not self.model:
            raise HelloAgentsException("Model name must be provided (model parameter or LLM_MODEL_ID environment variable)")
        if not self.api_key:
            raise HelloAgentsException("API key must be provided (api_key parameter or LLM_API_KEY environment variable)")
        if not self.base_url:
            raise HelloAgentsException("Service URL must be provided (base_url parameter or LLM_BASE_URL environment variable)")

        # Create adapter (auto detection)
        self._adapter: BaseLLMAdapter = create_adapter(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout,
            model=self.model
        )

        # Statistics of the last call (for streaming calls)
        self.last_call_stats: Optional[StreamStats] = None

    def think(self, messages: List[Dict[str, str]], temperature: Optional[float] = None) -> Iterator[str]:
        """
        Call the LLM for reasoning and return a streaming response.
        This is the main call method, using streaming by default for better user experience.

        Args:
            messages: List of messages
            temperature: Temperature parameter, uses initialization value if not provided

        Yields:
            str: Text chunks of the streaming response

        Note:
            After streaming call, you can get statistics via llm.last_call_stats
        """
        print(f"🧠 Calling {self.model} model...")

        # Prepare parameters
        kwargs = {
            "temperature": temperature if temperature is not None else self.temperature,
        }
        if self.max_tokens:
            kwargs["max_tokens"] = self.max_tokens

        try:
            print("✅ LLM response successful:")
            for chunk in self._adapter.stream_invoke(messages, **kwargs):
                print(chunk, end="", flush=True)
                yield chunk
            print()  # New line

            # Save statistics
            if hasattr(self._adapter, 'last_stats'):
                self.last_call_stats = self._adapter.last_stats # type: ignore

        except Exception as e:
            print(f"❌ Error occurred when calling LLM API: {e}")
            raise

    def invoke(self, messages: List[Dict[str, str]], **kwargs) -> LLMResponse:
        """
        Non-streaming LLM call, returns complete response object.

        Args:
            messages: List of messages
            **kwargs: Other parameters (temperature, max_tokens, etc.)

        Returns:
            LLMResponse: Response object containing content, statistics, reasoning process (thinking model)

        Example:
            response = llm.invoke([{"role": "user", "content": "Hello"}])
            print(response.content)  # Response content
            print(response.usage)    # Token usage
            print(response.latency_ms)  # Latency
            if response.reasoning_content:  # Reasoning process of thinking model
                print(response.reasoning_content)
        """
        # Merge parameters
        call_kwargs = {
            "temperature": kwargs.pop("temperature", self.temperature),
        }
        if self.max_tokens:
            call_kwargs["max_tokens"] = kwargs.pop("max_tokens", self.max_tokens)
        call_kwargs.update(kwargs)

        return self._adapter.invoke(messages, **call_kwargs)

    def stream_invoke(self, messages: List[Dict[str, str]], **kwargs) -> Iterator[str]:
        """
        Alias for streaming LLM call, same functionality as think method.
        Maintains backward compatibility.

        Args:
            messages: List of messages
            **kwargs: Other parameters

        Yields:
            str: Text chunks of the streaming response

        Note:
            After streaming call, you can get statistics via llm.last_call_stats
        """
        temperature = kwargs.pop("temperature", None)

        # Prepare parameters
        call_kwargs = {}
        if self.max_tokens:
            call_kwargs["max_tokens"] = kwargs.pop("max_tokens", self.max_tokens)
        call_kwargs.update(kwargs)

        for chunk in self._adapter.stream_invoke(messages, temperature=temperature, **call_kwargs):
            yield chunk

        # Save statistics
        if hasattr(self._adapter, 'last_stats'):
            self.last_call_stats = self._adapter.last_stats # type: ignore

    def invoke_with_tools(
        self,
        messages: List[Dict],
        tools: List[Dict],
        tool_choice: Union[str, Dict] = "auto",
        **kwargs
    ) -> LLMToolResponse:
        """
        Call LLM with tool calling support (Function Calling)

        This is the core method supporting OpenAI Function Calling for structured tool invocation.

        Args:
            messages: List of messages, format [{"role": "user", "content": "..."}]
            tools: List of tool schemas, following OpenAI Function Calling specification
            tool_choice: Tool selection strategy
                - "auto": Let the model decide whether to call tools (default)
                - "none": Force no tool call
                - "required": Force tool call
                - {"type": "function", "function": {"name": "tool_name"}}: Force call specified tool
            **kwargs: Other parameters (temperature, max_tokens, etc.)

        Returns:
            Unified tool call response object (LLMToolResponse)

        Raises:
            HelloAgentsException: When LLM call fails
        """
        # Merge parameters
        call_kwargs = {
            "temperature": kwargs.pop("temperature", self.temperature),
            "tool_choice": tool_choice,
        }
        if self.max_tokens:
            call_kwargs["max_tokens"] = kwargs.pop("max_tokens", self.max_tokens)
        call_kwargs.update(kwargs)

        return self._adapter.invoke_with_tools(messages, tools, **call_kwargs)

    # ==================== Async Methods ====================

    async def ainvoke(self, messages: List[Dict[str, str]], **kwargs) -> LLMResponse:
        """
        Async non-streaming LLM call

        Runs synchronous invoke method in a thread pool to avoid blocking the event loop

        Args:
            messages: List of messages
            **kwargs: Other parameters (temperature, max_tokens, etc.)

        Returns:
            LLMResponse: Response object containing content and statistics

        Example:
            response = await llm.ainvoke([{"role": "user", "content": "Hello"}])
            print(response.content)
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.invoke(messages, **kwargs)
        )

    async def astream_invoke(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> AsyncIterator[str]:
        """
        True async streaming LLM call (uses adapter's async implementation)

        Args:
            messages: List of messages
            **kwargs: Other parameters

        Yields:
            str: Text chunks of streaming response (real-time return)

        Example:
            async for chunk in llm.astream_invoke(messages):
                print(chunk, end="", flush=True)
        """
        # Use adapter's async streaming method
        async for chunk in self._adapter.astream_invoke(messages, **kwargs):
            yield chunk

        # Save statistics
        if hasattr(self._adapter, 'last_stats'):
            self.last_call_stats = self._adapter.last_stats # type: ignore

    async def ainvoke_with_tools(
        self,
        messages: List[Dict],
        tools: List[Dict],
        tool_choice: Union[str, Dict] = "auto",
        **kwargs
    ) -> LLMToolResponse:
        """
        Async call LLM with tool calling support (Function Calling)

        Args:
            messages: List of messages
            tools: List of tool schemas
            tool_choice: Tool selection strategy
            **kwargs: Other parameters

        Returns:
            Unified tool call response object (LLMToolResponse)
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.invoke_with_tools(messages, tools, tool_choice, **kwargs)
        )
