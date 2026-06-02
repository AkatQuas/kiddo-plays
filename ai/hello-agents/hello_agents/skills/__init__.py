"""Skills Externalized Knowledge System

Skills are the core implementation of "knowledge externalization",
allowing models to load domain knowledge on demand without fine-tuning.

Features:
- Progressive disclosure: Load metadata only at startup, full content on demand
- Cache-friendly: Injected as tool_result without modifying system_prompt
- Human-editable: SKILL.md files with full version control support
- Token efficient: ~85% token reduction expected (20 skills scenario)

Usage Example:
    >>> from hello_agents.skills import SkillLoader
    >>> loader = SkillLoader(skills_dir=Path("skills"))
    >>> # Get all skill descriptions (for system prompt)
    >>> descriptions = loader.get_descriptions()
    >>> # Load full skill content on demand
    >>> skill = loader.get_skill("pdf")
    >>> print(skill.body)
"""

from .loader import Skill, SkillLoader

__all__ = [
    "SkillLoader",
    "Skill",
]
