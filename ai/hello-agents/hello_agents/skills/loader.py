"""Skills Loader

Implements progressive disclosure mechanism:
- Layer 1: Metadata (loaded on startup, ~100 tokens/skill)
- Layer 2: SKILL.md body (loaded on demand, ~2000+ tokens)
- Layer 3: Resources (optional, loaded on demand)
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import yaml


@dataclass
class Skill:
    """Skill Data Class"""
    name: str
    description: str
    body: str
    path: Path
    dir: Path

    @property
    def scripts(self) -> List[Path]:
        """Get all files in the scripts/ directory"""
        scripts_dir = self.dir / "scripts"
        if not scripts_dir.exists():
            return []
        return [f for f in scripts_dir.rglob("*") if f.is_file()]

    @property
    def examples(self) -> List[Path]:
        """Get all files in the examples/ directory"""
        examples_dir = self.dir / "examples"
        if not examples_dir.exists():
            return []
        return [f for f in examples_dir.rglob("*") if f.is_file()]

    @property
    def references(self) -> List[Path]:
        """Get all files in the references/ directory"""
        references_dir = self.dir / "references"
        if not references_dir.exists():
            return []
        return [f for f in references_dir.rglob("*") if f.is_file()]


class SkillLoader:
    """
    Skill Loader

    Features:
    - Loads only metadata on startup
    - Loads full skill content on demand
    - Scans the skills/ directory
    - Supports hot reload

    Usage Example:
        >>> loader = SkillLoader(skills_dir=Path("skills"))
        >>> # Get all skill descriptions
        >>> descriptions = loader.get_descriptions()
        >>> # Load full skill on demand
        >>> skill = loader.get_skill("pdf")
        >>> print(skill.body)
    """

    def __init__(self, skills_dir: Path):
        """Initialize Skill Loader

        Args:
            skills_dir: Path to the skills directory
        """
        self.skills_dir = Path(skills_dir)
        self.skills_dir.mkdir(parents=True, exist_ok=True)

        # Full skill cache
        self.skills_cache: Dict[str, Skill] = {}

        # Metadata only cache (loaded on startup)
        self.metadata_cache: Dict[str, Dict] = {}

        # Scan and load metadata on startup
        self._scan_skills()

    def _scan_skills(self):
        """Scan the skills/ directory and load metadata"""
        for skill_dir in self.skills_dir.iterdir():
            if not skill_dir.is_dir():
                continue

            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue

            # Only parse frontmatter (metadata)
            metadata = self._parse_frontmatter_only(skill_md)
            if not metadata:
                continue

            name = metadata.get("name", skill_dir.name)
            self.metadata_cache[name] = {
                "name": name,
                "description": metadata.get("description", ""),
                "path": skill_md,
                "dir": skill_dir
            }

    def _parse_frontmatter_only(self, path: Path) -> Optional[Dict]:
        """Parse only the YAML frontmatter

        Args:
            path: Path to the SKILL.md file

        Returns:
            Parsed metadata dictionary, or None if parsing fails
        """
        try:
            content = path.read_text(encoding='utf-8')
        except Exception:
            return None

        # Match content between --- delimiters
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)

        if not match:
            return None

        yaml_str = match.group(1)

        # Parse YAML
        try:
            metadata = yaml.safe_load(yaml_str) or {}
        except yaml.YAMLError:
            return None

        # Validate required fields
        if "name" not in metadata or "description" not in metadata:
            return None

        return metadata

    def get_descriptions(self) -> str:
        """Get metadata descriptions for all skills (for system prompt)

        Returns:
            Formatted list of skill descriptions
        """
        if not self.metadata_cache:
            return "(No available skills)"

        return "\n".join(
            f"- {name}: {skill['description']}"
            for name, skill in self.metadata_cache.items()
        )

    def get_skill(self, name: str) -> Optional[Skill]:
        """
        Load full skill content on demand

        Args:
            name: Skill name

        Returns:
            Skill object, or None if it does not exist
        """
        # Check cache
        if name in self.skills_cache:
            return self.skills_cache[name]

        # Check metadata
        if name not in self.metadata_cache:
            return None

        metadata = self.metadata_cache[name]

        # Read full content
        try:
            content = metadata["path"].read_text(encoding='utf-8')
        except Exception:
            return None

        # Extract frontmatter and body
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)

        if not match:
            return None

        frontmatter, body = match.groups()

        # Parse frontmatter (verify consistency)
        try:
            parsed_metadata = yaml.safe_load(frontmatter) or {}
        except yaml.YAMLError:
            return None

        # Create Skill object
        skill = Skill(
            name=parsed_metadata.get("name", name),
            description=parsed_metadata.get("description", ""),
            body=body.strip(),
            path=metadata["path"],
            dir=metadata["dir"]
        )

        # Cache
        self.skills_cache[name] = skill

        return skill

    def list_skills(self) -> List[str]:
        """List all available skills

        Returns:
            List of skill names
        """
        return list(self.metadata_cache.keys())

    def reload(self):
        """Rescan the skills directory (hot reload)"""
        self.skills_cache.clear()
        self.metadata_cache.clear()
        self._scan_skills()
