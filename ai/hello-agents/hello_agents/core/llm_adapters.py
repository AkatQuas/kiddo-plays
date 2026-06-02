"""LLM Adapters - Support for OpenAI, Anthropropic, Gemini, and other API formats"""

import time
import asyncio
import json
from abc import ABC, abstractmethod
from typing import Optional, Iterator, List, Dict, Any, Union, AsyncIterator

from .llm_response import LLMResponse, StreamStats, LLMToolResponse, ToolCall
from .exceptions import HelloAgentsException


class BaseLLMAdapter(ABC):
    """Base class for LLM adapters"""

    def __init__(self, api_key: str, base_url: Optional[str], timeout: int, model: str):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        self.model = model
        self._client = None
        self._async_client = None

    @abstractmethod
    def create_client(self) -> Any:
        """Create client instance"""
        pass

    def create_async_client(self) -> Any:
        """Create async client instance (optional implementation in subclasses)"""
        return None

    @abstractmethod
    def invoke(self, messages: List[Dict], **kwargs) -> LLMResponse:
        """Non-streaming invocation"""
        pass

    @abstractmethod
    def stream_invoke(self, messages: List[Dict], **kwargs) -> Iterator[str]:
        """Streaming invocation, returns generator"""
        pass

    async def astream_invoke(self, messages: List[Dict], **kwargs) -> AsyncIterator[str]:
        """Async streaming invocation (subclasses may implement true async)

        Default implementation: wrap sync streaming method with queue + thread pool
        """
        queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _stream_to_queue():
            try:
                for chunk in self.stream_invoke(messages, **kwargs):
                    asyncio.run_coroutine_threadsafe(queue.put(chunk), loop)
            except Exception as e:
                asyncio.run_coroutine_threadsafe(queue.put(e), loop)
            finally:
                asyncio.run_coroutine_threadsafe(queue.put(None), loop)

        # Run sync streaming method in a thread pool
        loop.run_in_executor(None, _stream_to_queue)

        # Fetch chunks one by one from the queue
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            if isinstance(chunk, Exception):
                raise chunk
            yield chunk

    @abstractmethod
    def invoke_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMToolResponse:
        """Tool calling (Function Calling)"""
        pass

    def _is_thinking_model(self, model_name: str) -> bool:
        """Check if the model is a thinking/reasoning model"""
        thinking_keywords = ["reasoner", "o1", "o3", "thinking"]
        model_lower = model_name.lower()
        return any(keyword in model_lower for keyword in thinking_keywords)


class OpenAIAdapter(BaseLLMAdapter):
    """OpenAI-compatible API adapter (default)

    Supports:
    - Official OpenAI API
    - All OpenAI-compatible APIs (DeepSeek, Qwen, Kimi, Zhipu, etc.)
    - Thinking Models (o1, deepseek-reasoner, etc.)
    """

    def create_client(self) -> Any:
        """Create OpenAI client"""
        from openai import OpenAI

        return OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout
        )

    def create_async_client(self) -> Any:
        """Create OpenAI async client"""
        from openai import AsyncOpenAI

        return AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout
        )
    
    def invoke(self, messages: List[Dict], **kwargs) -> LLMResponse:
        """Non-streaming invocation"""
        if not self._client:
            self._client = self.create_client()
        
        start_time = time.time()
        
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                **kwargs
            )
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Extract content and reasoning process
            choice = response.choices[0]
            content = choice.message.content or ""
            reasoning_content = None
            
            # Special handling for thinking models
            if self._is_thinking_model(self.model):
                # OpenAI o1 series: reasoning_content in message
                if hasattr(choice.message, 'reasoning_content'):
                    reasoning_content = choice.message.reasoning_content
                # DeepSeek reasoner: may be in other fields
                elif hasattr(choice, 'reasoning_content'):
                    reasoning_content = choice.reasoning_content
            
            # Extract usage information
            usage = {}
            if hasattr(response, 'usage') and response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }
            
            return LLMResponse(
                content=content,
                model=self.model,
                usage=usage,
                latency_ms=latency_ms,
                reasoning_content=reasoning_content
            )
            
        except Exception as e:
            raise HelloAgentsException(f"OpenAI API call failed: {str(e)}")
    
    def stream_invoke(self, messages: List[Dict], **kwargs) -> Iterator[str]:
        """Streaming invocation"""
        if not self._client:
            self._client = self.create_client()
        
        start_time = time.time()
        
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                **kwargs
            )
            
            collected_content = []
            reasoning_content = None
            usage = {}
            
            for chunk in response:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    
                    # Extract content
                    if delta.content:
                        collected_content.append(delta.content)
                        yield delta.content
                    
                    # Reasoning process for thinking models
                    if self._is_thinking_model(self.model):
                        if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                            if reasoning_content is None:
                                reasoning_content = ""
                            reasoning_content += delta.reasoning_content

                # Extract usage (may be included in the last streaming chunk)
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage = {
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens,
                        "total_tokens": chunk.usage.total_tokens,
                    }

            latency_ms = int((time.time() - start_time) * 1000)

            # Store statistics for external access
            self.last_stats = StreamStats(
                model=self.model,
                usage=usage,
                latency_ms=latency_ms,
                reasoning_content=reasoning_content
            )

        except Exception as e:
            raise HelloAgentsException(f"OpenAI API streaming call failed: {str(e)}")

    async def astream_invoke(self, messages: List[Dict], **kwargs) -> AsyncIterator[str]:
        """True async streaming invocation (using native OpenAI async client)"""
        if not self._async_client:
            self._async_client = self.create_async_client()

        start_time = time.time()

        try:
            response = await self._async_client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                **kwargs
            )

            collected_content = []
            reasoning_content = None
            usage = {}

            async for chunk in response:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta

                    # Extract content
                    if delta.content:
                        collected_content.append(delta.content)
                        yield delta.content

                    # Reasoning process for thinking models
                    if self._is_thinking_model(self.model):
                        if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                            if reasoning_content is None:
                                reasoning_content = ""
                            reasoning_content += delta.reasoning_content

                # Extract usage (may be included in the last streaming chunk)
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage = {
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens,
                        "total_tokens": chunk.usage.total_tokens,
                    }

            latency_ms = int((time.time() - start_time) * 1000)

            # Store statistics for external access
            self.last_stats = StreamStats(
                model=self.model,
                usage=usage,
                latency_ms=latency_ms,
                reasoning_content=reasoning_content
            )

        except Exception as e:
            raise HelloAgentsException(f"OpenAI API async streaming call failed: {str(e)}")

    def invoke_with_tools(self, messages: List[Dict], tools: List[Dict],
                         tool_choice: Union[str, Dict] = "auto", **kwargs) -> LLMToolResponse:
        """Tool calling (Function Calling)"""
        if not self._client:
            self._client = self.create_client()

        start_time = time.time()
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice=tool_choice,
                **kwargs
            )

            latency_ms = int((time.time() - start_time) * 1000)
            message = response.choices[0].message

            tool_calls = []
            if message.tool_calls:
                for tc in message.tool_calls:
                    tool_calls.append(ToolCall(
                        id=tc.id,
                        name=tc.function.name,
                        arguments=tc.function.arguments
                    ))

            usage = {}
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }

            return LLMToolResponse(
                content=message.content,
                tool_calls=tool_calls,
                model=response.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"OpenAI Function Calling failed: {str(e)}")


class AnthropicAdapter(BaseLLMAdapter):
    """Anthropic Claude adapter

    Handles Claude-specific message format:
    - Separate system parameter (not in messages)
    - Message format conversion
    """

    def create_client(self) -> Any:
        """Create Anthropic client"""
        try:
            from anthropic import Anthropic
        except ImportError:
            raise HelloAgentsException(
                "To use Anthropic, install: pip install anthropic"
            )

        return Anthropic(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout
        )

    def _convert_messages(self, messages: List[Dict]) -> tuple[Optional[str], List[Dict]]:
        """Convert message format and extract system message"""
        system_content = None
        converted_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                converted_messages.append(msg)

        return system_content, converted_messages

    def invoke(self, messages: List[Dict], **kwargs) -> LLMResponse:
        """Non-streaming invocation"""
        if not self._client:
            self._client = self.create_client()

        start_time = time.time()
        system_content, converted_messages = self._convert_messages(messages)

        try:
            # Build request parameters
            request_params = {
                "model": self.model,
                "messages": converted_messages,
                "max_tokens": kwargs.pop("max_tokens", 4096),
                **kwargs
            }
            if system_content:
                request_params["system"] = system_content

            response = self._client.messages.create(**request_params)

            latency_ms = int((time.time() - start_time) * 1000)

            # Extract content
            content = ""
            if response.content:
                for block in response.content:
                    if hasattr(block, 'text'):
                        content += block.text

            # Extract usage
            usage = {}
            if hasattr(response, 'usage') and response.usage:
                usage = {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
                }

            return LLMResponse(
                content=content,
                model=self.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"Anthropic API call failed: {str(e)}")

    def stream_invoke(self, messages: List[Dict], **kwargs) -> Iterator[str]:
        """Streaming invocation"""
        if not self._client:
            self._client = self.create_client()

        start_time = time.time()
        system_content, converted_messages = self._convert_messages(messages)

        try:
            request_params = {
                "model": self.model,
                "messages": converted_messages,
                "max_tokens": kwargs.pop("max_tokens", 4096),
                "stream": True,
                **kwargs
            }
            if system_content:
                request_params["system"] = system_content

            usage = {}

            with self._client.messages.stream(**request_params) as stream:
                for text in stream.text_stream:
                    yield text

                # Get final message to extract usage
                final_message = stream.get_final_message()
                if hasattr(final_message, 'usage') and final_message.usage:
                    usage = {
                        "prompt_tokens": final_message.usage.input_tokens,
                        "completion_tokens": final_message.usage.output_tokens,
                        "total_tokens": final_message.usage.input_tokens + final_message.usage.output_tokens,
                    }

            latency_ms = int((time.time() - start_time) * 1000)

            self.last_stats = StreamStats(
                model=self.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"Anthropic API streaming call failed: {str(e)}")

    def invoke_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMToolResponse:
        """Tool calling (Anthropic format)"""
        if not self._client:
            self._client = self.create_client()

        system_content, converted_messages = self._convert_messages(messages)

        start_time = time.time()
        try:
            request_params = {
                "model": self.model,
                "messages": converted_messages,
                "tools": tools,
                "max_tokens": kwargs.pop("max_tokens", 4096),
                **kwargs
            }
            if system_content:
                request_params["system"] = system_content

            response = self._client.messages.create(**request_params)
            latency_ms = int((time.time() - start_time) * 1000)

            content = ""
            tool_calls = []
            for block in response.content:
                if block.type == "text":
                    content += block.text
                elif block.type == "tool_use":
                    tool_calls.append(ToolCall(
                        id=block.id,
                        name=block.name,
                        arguments=json.dumps(block.input)
                    ))

            usage = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }

            return LLMToolResponse(
                content=content if content else None,
                tool_calls=tool_calls,
                model=self.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"Anthropic tool calling failed: {str(e)}")


class GeminiAdapter(BaseLLMAdapter):
    """Google Gemini adapter

    Handles Gemini-specific API format
    Uses the new google.genai package (replaces deprecated google.generativeai)
    """

    def create_client(self) -> Any:
        """Create Gemini client"""
        try:
            from google import genai
        except ImportError:
            raise HelloAgentsException(
                "To use Gemini, install: pip install google-genai"
            )

        client = genai.Client(api_key=self.api_key)
        return client

    def _convert_messages(self, messages: List[Dict]) -> tuple[Optional[str], List[Dict]]:
        """Convert message format"""
        system_instruction = None
        converted_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            else:
                # Gemini uses "user" and "model" as roles
                role = "model" if msg["role"] == "assistant" else "user"
                converted_messages.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}]
                })

        return system_instruction, converted_messages

    def invoke(self, messages: List[Dict], **kwargs) -> LLMResponse:
        """Non-streaming invocation"""
        if not self._client:
            self._client = self.create_client()

        from google.genai import types as genai_types

        start_time = time.time()
        system_instruction, converted_messages = self._convert_messages(messages)

        try:
            # Create generation config
            config_params = {}
            if "temperature" in kwargs:
                config_params["temperature"] = kwargs.pop("temperature")
            if "max_tokens" in kwargs:
                config_params["max_output_tokens"] = kwargs.pop("max_tokens")
            if system_instruction:
                config_params["system_instruction"] = system_instruction

            response = self._client.models.generate_content(
                model=self.model,
                contents=converted_messages,
                config=genai_types.GenerateContentConfig(**config_params) if config_params else None
            )

            latency_ms = int((time.time() - start_time) * 1000)

            # Extract content
            content = response.text if hasattr(response, 'text') else ""

            # Extract usage
            usage = {}
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = {
                    "prompt_tokens": response.usage_metadata.prompt_token_count or 0,
                    "completion_tokens": response.usage_metadata.candidates_token_count or 0,
                    "total_tokens": response.usage_metadata.total_token_count or 0,
                }

            return LLMResponse(
                content=content,
                model=self.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"Gemini API call failed: {str(e)}")

    def stream_invoke(self, messages: List[Dict], **kwargs) -> Iterator[str]:
        """Streaming invocation"""
        if not self._client:
            self._client = self.create_client()

        from google.genai import types as genai_types

        start_time = time.time()
        system_instruction, converted_messages = self._convert_messages(messages)

        try:
            # Create generation config
            config_params = {}
            if "temperature" in kwargs:
                config_params["temperature"] = kwargs.pop("temperature")
            if "max_tokens" in kwargs:
                config_params["max_output_tokens"] = kwargs.pop("max_tokens")
            if system_instruction:
                config_params["system_instruction"] = system_instruction

            usage = {}

            response = self._client.models.generate_content_stream(
                model=self.model,
                contents=converted_messages,
                config=genai_types.GenerateContentConfig(**config_params) if config_params else None
            )

            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    yield chunk.text

                # Try to extract usage (may be in the last chunk)
                if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                    usage = {
                        "prompt_tokens": chunk.usage_metadata.prompt_token_count or 0,
                        "completion_tokens": chunk.usage_metadata.candidates_token_count or 0,
                        "total_tokens": chunk.usage_metadata.total_token_count or 0,
                    }

            latency_ms = int((time.time() - start_time) * 1000)

            self.last_stats = StreamStats(
                model=self.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"Gemini API streaming call failed: {str(e)}")

    def invoke_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMToolResponse:
        """Tool calling (Gemini format)"""
        if not self._client:
            self._client = self.create_client()

        from google.genai import types as genai_types

        system_instruction, converted_messages = self._convert_messages(messages)

        start_time = time.time()
        try:
            # Convert tool format to Gemini format
            gemini_tools = []
            for tool in tools:
                if tool.get("type") == "function":
                    func = tool["function"]
                    gemini_tools.append(
                        genai_types.FunctionDeclaration(
                            name=func["name"],
                            description=func.get("description", ""),
                            parameters=func.get("parameters", {})
                        )
                    )

            config_params = {}
            if gemini_tools:
                config_params["tools"] = [genai_types.Tool(function_declarations=gemini_tools)]
            if system_instruction:
                config_params["system_instruction"] = system_instruction

            response = self._client.models.generate_content(
                model=self.model,
                contents=converted_messages,
                config=genai_types.GenerateContentConfig(**config_params) if config_params else None
            )
            latency_ms = int((time.time() - start_time) * 1000)

            content = response.text if hasattr(response, 'text') else ""
            tool_calls = []

            # Parse Gemini tool calls
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        tool_calls.append(ToolCall(
                            id=f"call_{int(time.time()*1000)}",  # Gemini has no explicit call_id, generate one
                            name=part.function_call.name,
                            arguments=json.dumps(dict(part.function_call.args))
                        ))

            usage = {}
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = {
                    "prompt_tokens": response.usage_metadata.prompt_token_count or 0,
                    "completion_tokens": response.usage_metadata.candidates_token_count or 0,
                    "total_tokens": response.usage_metadata.total_token_count or 0
                }

            return LLMToolResponse(
                content=content if content else None,
                tool_calls=tool_calls,
                model=self.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"Gemini tool calling failed: {str(e)}")


def create_adapter(
    api_key: str,
    base_url: Optional[str],
    timeout: int,
    model: str
) -> BaseLLMAdapter:
    """
    Auto-select adapter based on base_url

    Detection logic:
    - anthropic.com -> AnthropicAdapter
    - googleapis.com or generativelanguage -> GeminiAdapter
    - others -> OpenAIAdapter (default)
    """
    if base_url:
        base_url_lower = base_url.lower()

        if "anthropic.com" in base_url_lower:
            return AnthropicAdapter(api_key, base_url, timeout, model)

        if "googleapis.com" in base_url_lower or "generativelanguage" in base_url_lower:
            return GeminiAdapter(api_key, base_url, timeout, model)

    # Default to OpenAI adapter (supports all OpenAI-format APIs)
    return OpenAIAdapter(api_key, base_url, timeout, model)