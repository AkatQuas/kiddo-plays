"""Base Protocol (Conceptual)

This module defines the basic interface concepts for protocols.
In actual implementations, each protocol is implemented independently
based on its own characteristics; inheritance from this base class is NOT required.

Protocol Interface Concepts:
- Protocol Identifier: Each protocol has a unique name and version
- Message Passing: Supports sending and receiving messages
- Information Query: Can retrieve basic protocol information

Actual Usage:
- MCP: Implemented using the fastmcp library
- A2A: Implemented using the official a2a library
- ANP: Implemented as a conceptual prototype

Note: This base class is for documentation purposes only.
Actual protocol implementations do not need to inherit from it.
"""

from enum import Enum


class ProtocolType(Enum):
    """Enumeration of protocol types"""
    MCP = "mcp"  # Model Context Protocol
    A2A = "a2a"  # Agent-to-Agent Protocol
    ANP = "anp"  # Agent Network Protocol


# Retained for backward compatibility
# Marked as conceptual, not intended for actual use
class Protocol:
    """Base Protocol (Conceptual, NOT for inheritance)

    This class defines fundamental protocol concepts, but actual implementations
    do not need to inherit from it. Each protocol is implemented independently.
    """

    def __init__(self, protocol_type: ProtocolType, version: str = "1.0.0"):
        """Initialize protocol

        Args:
            protocol_type: Type of the protocol
            version: Protocol version string
        """
        self._protocol_type = protocol_type
        self._version = version

    @property
    def protocol_name(self) -> str:
        """Get protocol name"""
        return self._protocol_type.value

    @property
    def version(self) -> str:
        """Get protocol version"""
        return self._version

    def __str__(self) -> str:
        return f"{self.__class__.__name__}(protocol={self.protocol_name}, version={self.version})"

    def __repr__(self) -> str:
        return self.__str__()
