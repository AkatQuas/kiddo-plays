"""Base Tool Class"""

import asyncio
import inspect
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional, get_type_hints

from pydantic import BaseModel

from .errors import ToolErrorCode
from .response import ToolResponse


def tool_action(name: str | None = None, description: str |None = None):
    """Decorator: Mark a method as an expandable tool action

    Usage:
        @tool_action("memory_add", "Add new memory")
        def _add_memory(self, content: str, importance: float = 0.5) -> str:
            '''Add memory

            Args:
                content: Memory content
                importance: Importance score
            '''
            ...

    Args:
        name: Tool name (auto-generated from method name if not provided)
        description: Tool description (extracted from docstring if not provided)
    """
    def decorator(func: Callable):
        func._is_tool_action = True
        func._tool_name = name
        func._tool_description = description
        return func
    return decorator


class ToolParameter(BaseModel):
    """Tool parameter definition"""
    name: str
    type: str
    description: str
    required: bool = True
    default: Any = None


class Tool(ABC):
    """Base Tool Class

    Supports two usage modes:
    1. Normal mode: Tool used as a single entity
    2. Expandable mode: Tool can be expanded into multiple independent sub-tools (each for one function)

    Expandable mode supports two implementations:
    - Manually define sub-tool classes (traditional)
    - Auto-generate using @tool_action decorator (recommended)

    Features:
    - run() returns ToolResponse object (instead of string)
    - run_with_timing() auto-adds timing statistics
    - Supports structured status, data, and error messages
    """

    def __init__(self, name: str, description: str, expandable: bool = False):
        """Initialize tool

        Args:
            name: Tool name
            description: Tool description
            expandable: Whether can expand into sub-tools
        """
        self.name = name
        self.description = description
        self.expandable = expandable

    @abstractmethod
    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute tool and return ToolResponse object

        Use convenience methods to create responses:
        - ToolResponse.success(text="...", data={...})
        - ToolResponse.partial(text="...", data={...})
        - ToolResponse.error(code="NOT_FOUND", message="...")

        Args:
            parameters: Tool parameters dictionary

        Returns:
            ToolResponse: Standardized tool response object
        """
        pass

    @abstractmethod
    def get_parameters(self) -> List[ToolParameter]:
        """Get tool parameter definitions"""
        pass

    def run_with_timing(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute tool with auto timing and context logging

        This method will:
        1. Record start time
        2. Call run()
        3. Calculate execution time and add to stats
        4. Add parameters to context

        Args:
            parameters: Tool parameters dictionary

        Returns:
            ToolResponse: Response with timing statistics
        """
        start_time = time.time()

        try:
            response = self.run(parameters)
        except Exception as e:
            # Catch unhandled exceptions and convert to error response
            elapsed_ms = int((time.time() - start_time) * 1000)
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Unhandled exception during tool execution: {str(e)}",
                stats={"time_ms": elapsed_ms},
                context={"params_input": parameters, "tool_name": self.name}
            )

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Add timing stats
        if response.stats is None:
            response.stats = {}
        response.stats["time_ms"] = elapsed_ms

        # Add context
        if response.context is None:
            response.context = {}
        response.context["params_input"] = parameters
        response.context["tool_name"] = self.name

        return response

    async def arun(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Async execute tool

        Default implementation: Run sync run() in thread pool
        Subclasses may override for true async execution

        Args:
            parameters: Tool parameters dictionary

        Returns:
            ToolResponse: Standardized tool response object
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.run(parameters)
        )

    async def arun_with_timing(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Async execute tool with auto timing statistics

        Args:
            parameters: Tool parameters dictionary

        Returns:
            ToolResponse: Response with timing statistics
        """
        start_time = time.time()

        try:
            response = await self.arun(parameters)
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Unhandled exception during tool execution: {str(e)}",
                stats={"time_ms": elapsed_ms},
                context={"params_input": parameters, "tool_name": self.name}
            )

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Add timing stats
        if response.stats is None:
            response.stats = {}
        response.stats["time_ms"] = elapsed_ms

        # Add context
        if response.context is None:
            response.context = {}
        response.context["params_input"] = parameters
        response.context["tool_name"] = self.name

        return response

    def get_expanded_tools(self) -> Optional[List['Tool']]:
        """Get expanded sub-tool list

        Default implementation: Auto-generate sub-tools from @tool_action decorated methods
        Subclasses may override for custom expansion logic

        Returns:
            List of sub-tools if expandable, else None
        """
        if not self.expandable:
            return None

        # Auto-generate tools from decorated methods
        tools = []
        for name, method in inspect.getmembers(self, predicate=inspect.ismethod):
            if hasattr(method, '_is_tool_action'):
                tool = AutoGeneratedTool(
                    parent=self,
                    method=method,
                    name=method._tool_name, # type: ignore
                    description=method._tool_description # type: ignore
                )
                tools.append(tool)

        return tools if tools else None

    def validate_parameters(self, parameters: Dict[str, Any]) -> bool:
        """Validate parameters"""
        required_params = [p.name for p in self.get_parameters() if p.required]
        return all(param in parameters for param in required_params)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": [param.dict() for param in self.get_parameters()]
        }

    def to_openai_schema(self) -> Dict[str, Any]:
        """Convert to OpenAI function calling schema format

        Used by FunctionCallAgent to enable native OpenAI function calling

        Returns:
            Schema conforming to OpenAI function calling standard
        """
        parameters = self.get_parameters()

        # Build properties
        properties = {}
        required = []

        for param in parameters:
            # Base property definition
            prop = {
                "type": param.type,
                "description": param.description
            }

            # Add default value to description (OpenAI schema does not support default field)
            if param.default is not None:
                prop["description"] = f"{param.description} (default: {param.default})"

            # Add items definition if array type
            if param.type == "array":
                prop["items"] = {"type": "string"}  # Default string array

            properties[param.name] = prop

            # Collect required parameters
            if param.required:
                required.append(param.name)

        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required
                }
            }
        }

    def __str__(self) -> str:
        return f"Tool(name={self.name})"

    def __repr__(self) -> str:
        return self.__str__()


class AutoGeneratedTool(Tool):
    """Auto-generated tool - Auto extract parameters from method signature and docstring"""

    def __init__(self, parent: Tool, method: Callable, name: str | None = None, description: str | None = None):
        """Initialize auto-generated tool

        Args:
            parent: Parent tool instance
            method: Decorated method
            name: Tool name (generated from method name if None)
            description: Tool description (extracted from docstring if None)
        """
        self.parent = parent
        self.method = method

        # Generate tool name
        if name is None:
            # Generate from method name: _add_memory -> parent_name_add_memory
            method_name = method.__name__.lstrip('_')
            name = f"{parent.name}_{method_name}"

        # Extract description
        if description is None:
            description = self._extract_description_from_docstring()

        super().__init__(name=name, description=description)

        # Auto parse parameters
        self._parameters = self._parse_parameters()

    def _extract_description_from_docstring(self) -> str:
        """Extract description from docstring"""
        doc = inspect.getdoc(self.method)
        if not doc:
            return f"Execute {self.method.__name__}"

        # Extract first line as description
        lines = doc.split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('Args:') and not line.startswith('Returns:'):
                return line

        return f"Execute {self.method.__name__}"

    def _parse_parameters(self) -> List[ToolParameter]:
        """Auto extract parameters from method signature and docstring"""
        sig = inspect.signature(self.method)
        type_hints = get_type_hints(self.method)
        docstring = inspect.getdoc(self.method) or ""

        # Parse parameter descriptions from docstring
        param_descriptions = self._parse_param_descriptions(docstring)

        parameters = []
        for param_name, param in sig.parameters.items():
            if param_name == 'self':
                continue

            # Get type
            param_type_hint = type_hints.get(param_name, str)
            param_type = self._python_type_to_tool_type(param_type_hint)

            # Check if required
            required = param.default == inspect.Parameter.empty
            default = None if required else param.default

            # Get description
            description = param_descriptions.get(param_name, f"Parameter {param_name}")

            parameters.append(ToolParameter(
                name=param_name,
                type=param_type,
                description=description,
                required=required,
                default=default
            ))

        return parameters

    def _parse_param_descriptions(self, docstring: str) -> Dict[str, str]:
        """Parse parameter descriptions from docstring

        Supported format:
            Args:
                param_name: Parameter description
                another_param: Another parameter description
        """
        descriptions = {}

        # Find Args: section
        args_match = re.search(r'Args:\s*\n(.*?)(?:\n\s*\n|Returns:|$)', docstring, re.DOTALL)
        if not args_match:
            return descriptions

        args_section = args_match.group(1)

        # Parse each parameter
        # Match format: param_name: description or param_name (type): description
        param_pattern = r'^\s*(\w+)(?:\s*\([^)]+\))?\s*:\s*(.+?)(?=^\s*\w+\s*(?:\([^)]+\))?\s*:|$)'
        matches = re.finditer(param_pattern, args_section, re.MULTILINE | re.DOTALL)

        for match in matches:
            param_name = match.group(1).strip()
            param_desc = match.group(2).strip()
            # Clean extra whitespace in description
            param_desc = re.sub(r'\s+', ' ', param_desc)
            descriptions[param_name] = param_desc

        return descriptions

    def _python_type_to_tool_type(self, py_type) -> str:
        """Convert Python type to tool type string"""
        # Handle generic types
        origin = getattr(py_type, '__origin__', None)
        if origin is not None:
            if origin is list:
                return "array"
            elif origin is dict:
                return "object"

        # Handle basic types
        type_map = {
            str: "string",
            int: "integer",
            float: "number",
            bool: "boolean",
            list: "array",
            dict: "object",
        }

        return type_map.get(py_type, "string")

    def get_parameters(self) -> List[ToolParameter]:
        """Get parameter list"""
        return self._parameters

    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute method and return ToolResponse object

        If decorated method returns string, auto-wrap to success response
        If returns ToolResponse, return directly
        """
        try:
            result = self.method(**parameters)

            # If method already returns ToolResponse, return directly
            if isinstance(result, ToolResponse):
                return result

            # Otherwise wrap to success response
            return ToolResponse.success(
                text=str(result),
                data={"output": result}
            )
        except Exception as e:
            return ToolResponse.error(
                code=ToolErrorCode.EXECUTION_ERROR,
                message=f"Method execution failed: {str(e)}"
            )
