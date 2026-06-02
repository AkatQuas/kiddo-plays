"""Exception Hierarchy"""

class HelloAgentsException(Exception):
    """Base exception class for HelloAgents"""
    pass

class LLMException(HelloAgentsException):
    """LLM-related exceptions"""
    pass

class AgentException(HelloAgentsException):
    """Agent-related exceptions"""
    pass

class ConfigException(HelloAgentsException):
    """Configuration-related exceptions"""
    pass

class ToolException(HelloAgentsException):
    """Tool-related exceptions"""
    pass
