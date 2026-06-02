"""Agent Communication Protocol Module

This module provides three primary agent communication protocols:
- MCP (Model Context Protocol): Model Context Protocol
- A2A (Agent-to-Agent Protocol): Agent-to-Agent Protocol
- ANP (Agent Network Protocol): Agent Network Protocol

Concise Import Examples:
    >>> from hello_agents.protocols import MCPClient, MCPServer
    >>> from hello_agents.protocols import A2AServer, A2AClient, AgentNetwork
    >>> from hello_agents.protocols import ANPDiscovery, ANPNetwork

Full Import Examples (Backward Compatible):
    >>> from hello_agents.protocols.mcp import MCPClient, MCPServer
    >>> from hello_agents.protocols.a2a import A2AServer, A2AClient
    >>> from hello_agents.protocols.anp import ANPDiscovery, ANPNetwork
"""

from .base import Protocol

# MCP Protocol - Export common classes (optional, requires fastmcp)
try:
    from .mcp import (
        MCPClient,
        MCPServer,
        create_context,
        parse_context,
    )
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    # Placeholders
    class MCPClient:
        def __init__(self, *args, **kwargs):
            raise ImportError("MCP requires fastmcp: pip install fastmcp")
    class MCPServer:
        def __init__(self, *args, **kwargs):
            raise ImportError("MCP requires fastmcp: pip install fastmcp")
    def create_context(*args, **kwargs):
        raise ImportError("MCP requires fastmcp: pip install fastmcp")
    def parse_context(*args, **kwargs):
        raise ImportError("MCP requires fastmcp: pip install fastmcp")

# A2A Protocol - Export common classes
from .a2a import (
    A2AAgent,
    A2AClient,
    A2AMessage,
    A2AServer,
    AgentNetwork,
    AgentRegistry,
    MessageType,
    create_message,
    parse_message,
)

# ANP Protocol - Export common classes
from .anp import (
    ANPDiscovery,
    ANPNetwork,
    ServiceInfo,
    discover_service,
    register_service,
)

__all__ = [
    # Base Protocol
    "Protocol",

    # MCP Protocol (Optional)
    "MCPClient",
    "MCPServer",
    "create_context",
    "parse_context",

    # A2A Protocol
    "A2AAgent",
    "A2AServer",
    "A2AClient",
    "AgentNetwork",
    "AgentRegistry",
    "A2AMessage",
    "MessageType",
    "create_message",
    "parse_message",

    # ANP Protocol
    "ANPDiscovery",
    "ANPNetwork",
    "ServiceInfo",
    "register_service",
    "discover_service",
]
