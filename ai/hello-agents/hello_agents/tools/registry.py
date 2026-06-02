"""Tool Registry - HelloAgents Native Tool System"""

from typing import Optional, Any, Callable, Dict
import time
from .base import Tool
from .response import ToolResponse, ToolStatus
from .errors import ToolErrorCode
from .circuit_breaker import CircuitBreaker

class ToolRegistry:
    """
    HelloAgents Tool Registry

    Provides tool registration, management, and execution.
    Supports two tool registration methods:
    1. Tool object registration (recommended)
    2. Direct function registration (simple)
    """

    def __init__(self, circuit_breaker: Optional[CircuitBreaker] = None):
        self._tools: dict[str, Tool] = {}
        self._functions: dict[str, dict[str, Any]] = {}

        # File metadata cache (for optimistic locking mechanism)
        self.read_metadata_cache: Dict[str, Dict[str, Any]] = {}

        # Circuit breaker (enabled by default)
        self.circuit_breaker = circuit_breaker or CircuitBreaker()

    def register_tool(self, tool: Tool, auto_expand: bool = True):
        """
        Register a Tool object

        Args:
            tool: Tool instance
            auto_expand: Whether to auto-expand expandable tools (default True)
        """
        # Check if tool is expandable
        if auto_expand and hasattr(tool, 'expandable') and tool.expandable:
            expanded_tools = tool.get_expanded_tools()
            if expanded_tools:
                # Register all expanded sub-tools
                for sub_tool in expanded_tools:
                    if sub_tool.name in self._tools:
                        print(f"⚠️ Warning: Tool '{sub_tool.name}' already exists and will be overwritten.")
                    self._tools[sub_tool.name] = sub_tool
                print(f"✅ Tool '{tool.name}' has been expanded into {len(expanded_tools)} independent tools.")
                return

        # Normal tool or non-expandable tool
        if tool.name in self._tools:
            print(f"⚠️ Warning: Tool '{tool.name}' already exists and will be overwritten.")

        self._tools[tool.name] = tool
        print(f"✅ Tool '{tool.name}' registered.")

    def register_function(
        self,
        func: Callable,
        name: Optional[str] = None,
        description: Optional[str] = None
    ):
        """
        Register a function directly as a tool (simple method)

        Supports two calling styles:
        1. Legacy: register_function(name, description, func)
        2. New: register_function(func, name=None, description=None)
           - Auto extract info from function name and docstring

        Args:
            func: Tool function
            name: Tool name (optional, uses function name by default)
            description: Tool description (optional, uses docstring by default)

        Example:
            >>> def my_tool(input: str) -> str:
            ...     '''This is my tool'''
            ...     return f"Processed: {input}"
            >>> registry.register_function(my_tool)
            >>> # Or specify name and description
            >>> registry.register_function(my_tool, name="custom_name", description="Custom description")
        """
        # Compatibility with legacy calling style: register_function(name, description, func)
        if isinstance(func, str) and callable(description):
            name, description, func = func, name, description

        # Auto extract name
        if name is None:
            name = func.__name__

        # Auto extract description
        if description is None:
            import inspect
            doc = inspect.getdoc(func)
            if doc:
                # Use first line as description
                description = doc.split('\n')[0].strip()
            else:
                description = f"Execute {name}"

        if name in self._functions:
            print(f"⚠️ Warning: Tool '{name}' already exists and will be overwritten.")

        self._functions[name] = {
            "description": description,
            "func": func
        }
        print(f"✅ Function tool '{name}' registered.")

    def unregister(self, name: str):
        """Unregister a tool"""
        if name in self._tools:
            del self._tools[name]
            print(f"🗑️ Tool '{name}' unregistered.")
        elif name in self._functions:
            del self._functions[name]
            print(f"🗑️ Tool '{name}' unregistered.")
        else:
            print(f"⚠️ Tool '{name}' does not exist.")

    def get_tool(self, name: str) -> Optional[Tool]:
        """Get Tool object"""
        return self._tools.get(name)

    def get_function(self, name: str) -> Optional[Callable]:
        """Get tool function"""
        func_info = self._functions.get(name)
        return func_info["func"] if func_info else None

    def execute_tool(self, name: str, input_text: str) -> ToolResponse:
        """
        Execute a tool and return ToolResponse (with circuit breaker protection)

        Args:
            name: Tool name
            input_text: Input parameters

        Returns:
            ToolResponse: Standardized tool response object
        """
        # Check circuit breaker
        if self.circuit_breaker.is_open(name):
            status = self.circuit_breaker.get_status(name)
            return ToolResponse.error(
                code=ToolErrorCode.CIRCUIT_OPEN,
                message=f"Tool '{name}' is currently disabled due to consecutive failures. Will be available in {status['recover_in_seconds']} seconds.",
                context={
                    "tool_name": name,
                    "circuit_status": status
                }
            )

        # Execute tool
        response = None

        # Priority: Tool objects (new protocol)
        if name in self._tools:
            tool = self._tools[name]
            try:
                # Parse parameters (supports JSON string or dict)
                import json
                if isinstance(input_text, str):
                    try:
                        parameters = json.loads(input_text)
                    except json.JSONDecodeError:
                        # Treat as plain string if not JSON
                        parameters = {"input": input_text}
                elif isinstance(input_text, dict):
                    parameters = input_text
                else:
                    parameters = {"input": str(input_text)}

                # Use run_with_timing for automatic timing
                response = tool.run_with_timing(parameters)
            except Exception as e:
                response = ToolResponse.error(
                    code=ToolErrorCode.EXECUTION_ERROR,
                    message=f"Exception while executing tool '{name}': {str(e)}",
                    context={"tool_name": name, "input": input_text}
                )

        # Fallback: function tools (auto-wrap to new protocol)
        elif name in self._functions:
            func = self._functions[name]["func"]
            start_time = time.time()

            try:
                result = func(input_text)
                elapsed_ms = int((time.time() - start_time) * 1000)

                # Wrap to ToolResponse
                response = ToolResponse.success(
                    text=str(result),
                    data={"output": result},
                    stats={"time_ms": elapsed_ms},
                    context={"tool_name": name, "input": input_text}
                )
            except Exception as e:
                elapsed_ms = int((time.time() - start_time) * 1000)
                response = ToolResponse.error(
                    code=ToolErrorCode.EXECUTION_ERROR,
                    message=f"Function execution failed: {str(e)}",
                    stats={"time_ms": elapsed_ms},
                    context={"tool_name": name, "input": input_text}
                )

        # Tool not found
        else:
            response = ToolResponse.error(
                code=ToolErrorCode.NOT_FOUND,
                message=f"Tool '{name}' not found",
                context={"tool_name": name}
            )

        # Record result to circuit breaker
        self.circuit_breaker.record_result(name, response)

        return response

    def get_tools_description(self) -> str:
        """
        Get formatted description string of all available tools

        Returns:
            Tool description string for prompt construction
        """
        descriptions = []

        # Tool object descriptions
        for tool in self._tools.values():
            descriptions.append(f"- {tool.name}: {tool.description}")

        # Function tool descriptions
        for name, info in self._functions.items():
            descriptions.append(f"- {name}: {info['description']}")

        return "\n".join(descriptions) if descriptions else "No available tools"

    def list_tools(self) -> list[str]:
        """List all tool names"""
        return list(self._tools.keys()) + list(self._functions.keys())

    def get_all_tools(self) -> list[Tool]:
        """Get all Tool objects"""
        return list(self._tools.values())

    def clear(self):
        """Clear all tools"""
        self._tools.clear()
        self._functions.clear()
        print("🧹 All tools cleared.")

    # ==================== Optimistic Lock Support ====================

    def cache_read_metadata(self, file_path: str, metadata: Dict[str, Any]):
        """Cache file metadata from Read tool

        Args:
            file_path: File path (relative to project_root)
            metadata: File metadata dict containing:
                - file_mtime_ms: File modification time (ms timestamp)
                - file_size_bytes: File size (bytes)
        """
        self.read_metadata_cache[file_path] = metadata

    def get_read_metadata(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get cached file metadata

        Args:
            file_path: File path

        Returns:
            Metadata dict, or None if not exists
        """
        return self.read_metadata_cache.get(file_path)

    def clear_read_cache(self, file_path: Optional[str] = None):
        """Clear file metadata cache

        Args:
            file_path: Specific file path, clear all if None
        """
        if file_path:
            self.read_metadata_cache.pop(file_path, None)
        else:
            self.read_metadata_cache.clear()

# Global tool registry instance
global_registry = ToolRegistry()