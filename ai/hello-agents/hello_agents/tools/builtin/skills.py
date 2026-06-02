"""Skill Tool - On-Demand Domain Knowledge for Agents

Allows Agents to load domain-specific knowledge only when needed.

Features:
- Progressive disclosure: Load full skill content only when required
- Cache-friendly: Injected as tool_result without modifying system_prompt
- Resource hints: Automatically lists available scripts, docs, examples, etc.
- Parameter substitution: Supports $ARGUMENTS placeholder

Usage Example:
    >>> from hello_agents.skills import SkillLoader
    >>> from hello_agents.tools.builtin.skill_tool import SkillTool
    >>> loader = SkillLoader(skills_dir=Path("skills"))
    >>> tool = SkillTool(skill_loader=loader)
    >>> # Agent invocation
    >>> response = tool.run({"skill": "pdf"})
"""

from typing import Dict, Any, List
from ..base import Tool, ToolParameter
from ...skills.loader import SkillLoader
from ..response import ToolResponse
from ..errors import ToolErrorCode


class SkillTool(Tool):
    """
    Skill Tool

    Enables models to load domain expertise on demand.
    """

    def __init__(self, skill_loader: SkillLoader):
        """Initialize Skill Tool

        Args:
            skill_loader: Skill loader instance
        """
        # Generate dynamic description
        descriptions = skill_loader.get_descriptions()

        super().__init__(
            name="Skill",
            description=f"""Load a skill to access specialized knowledge.

Available Skills:
{descriptions}

When to Use:
- Immediately when task clearly matches a skill description
- Before starting domain-specific work
- When requiring expertise not possessed by the model

Note: After loading a skill, strictly follow its instructions to complete the user task.""",
            expandable=False
        )
        self.skill_loader = skill_loader

    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter(
                name="skill",
                type="string",
                description="Name of the skill to load",
                required=True
            ),
            ToolParameter(
                name="args",
                type="string",
                description="Optional parameters to replace $ARGUMENTS placeholder in SKILL.md",
                required=False,
                default=""
            )
        ]

    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute skill loading

        Args:
            parameters: Dictionary containing skill name and optional args

        Returns:
            ToolResponse: Response containing full skill content
        """
        skill_name = parameters.get("skill", "")
        args = parameters.get("args", "")

        if not skill_name:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Skill name must be specified",
                context={"params_input": parameters}
            )

        try:
            # Load skill on demand
            skill = self.skill_loader.get_skill(skill_name)

            if not skill:
                available = ", ".join(self.skill_loader.list_skills())
                return ToolResponse.error(
                    code=ToolErrorCode.NOT_FOUND,
                    message=f"Skill '{skill_name}' does not exist. Available skills: {available}",
                    context={"params_input": parameters, "available_skills": self.skill_loader.list_skills()}
                )

            # Replace $ARGUMENTS placeholder
            content = skill.body.replace("$ARGUMENTS", args)

            # Generate available resources hint
            resources_hint = self._get_resources_hint(skill)

            # Build full skill content (cache-friendly injection)
            full_content = f"""<skill-loaded name="{skill_name}">
{content}
{resources_hint}
</skill-loaded>

✅ Skill loaded: {skill.name}
📝 Description: {skill.description}

Please strictly follow the above skill instructions to complete the user task."""

            return ToolResponse.success(
                text=full_content,
                data={
                    "name": skill.name,
                    "description": skill.description,
                    "loaded": True,
                    "token_estimate": len(full_content),
                    "has_resources": bool(resources_hint)
                }
            )

        except Exception as e:
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Failed to load skill: {str(e)}",
                context={"params_input": parameters, "error": str(e)}
            )

    def _get_resources_hint(self, skill) -> str:
        """Generate resource hint text

        Args:
            skill: Skill object

        Returns:
            Formatted resource hint string
        """
        resources = []

        for folder, label in [
            ("scripts", "Scripts"),
            ("references", "Reference Docs"),
            ("assets", "Assets"),
            ("examples", "Examples")
        ]:
            folder_path = skill.dir / folder
            if folder_path.exists():
                files = list(folder_path.glob("*"))
                if files:
                    file_list = ", ".join(f.name for f in files[:5])  # Show max 5 files
                    if len(files) > 5:
                        file_list += f" and {len(files)} more"
                    resources.append(f"  - {label}: {file_list}")

        if not resources:
            return ""

        return "\n\n**Available Resources**:\n" + "\n".join(resources)