"""NoteTool - Structured Note Tool

Provides structured note-taking capabilities for Agents:
- Create / Read / Update / Delete notes
- Organize by type (task state, conclusions, blockers, action plans, etc.)
- Persistent storage (Markdown format with YAML frontmatter)
- Search and filtering
- Integration with MemoryTool (optional)

Use Cases:
- Long-term task status tracking
- Recording key conclusions and dependencies
- To-do items and action plans
- Project knowledge base

Example Note Format:
```markdown
---
id: note_20250118_120000_0
title: Project Progress
type: task_state
tags: [milestone, phase1]
created_at: 2025-01-18T12:00:00
updated_at: 2025-01-18T12:00:00
---

# Project Progress

Completed requirements analysis, next step: design solution

## Key Milestones
- [x] Requirements Collection
- [ ] Solution Design
```
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from ..base import Tool, ToolParameter


class NoteTool(Tool):
    """Note Tool

    Provides structured note management for Agents, supporting multiple types:
    - task_state: Task status
    - conclusion: Key conclusion
    - blocker: Blocked issue
    - action: Action plan
    - reference: Reference material
    - general: General note

    Usage Example:
    ```python
    note_tool = NoteTool(workspace="./project_notes")

    # Create note
    note_tool.run({
        "action": "create",
        "title": "Project Progress",
        "content": "Completed requirements analysis, next step: design solution",
        "note_type": "task_state",
        "tags": ["milestone", "phase1"]
    })

    # List notes
    notes = note_tool.run({"action": "list", "note_type": "task_state"})
    ```
    """

    def __init__(
        self,
        workspace: str = "./notes",
        auto_backup: bool = True,
        max_notes: int = 1000
    ):
        super().__init__(
            name="note",
            description="Note Tool - Manage structured notes: create, read, update, delete. Supports task state, conclusions, blockers and more."
        )

        self.workspace = Path(workspace)
        self.auto_backup = auto_backup
        self.max_notes = max_notes

        # Ensure workspace exists
        self.workspace.mkdir(parents=True, exist_ok=True)

        # Note index file
        self.index_file = self.workspace / "notes_index.json"
        self._load_index()

    def _load_index(self):
        """Load note index"""
        if self.index_file.exists():
            with open(self.index_file, 'r', encoding='utf-8') as f:
                self.notes_index = json.load(f)
        else:
            self.notes_index = {
                "notes": [],
                "metadata": {
                    "created_at": datetime.now().isoformat(),
                    "total_notes": 0
                }
            }
            self._save_index()

    def _save_index(self):
        """Save note index"""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.notes_index, f, ensure_ascii=False, indent=2)

    def _generate_note_id(self) -> str:
        """Generate unique note ID"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        count = len(self.notes_index["notes"])
        return f"note_{timestamp}_{count}"

    def _get_note_path(self, note_id: str) -> Path:
        """Get note file path"""
        return self.workspace / f"{note_id}.md"

    def _note_to_markdown(self, note: Dict[str, Any]) -> str:
        """Convert note object to Markdown format"""
        # YAML frontmatter
        frontmatter = "---\n"
        frontmatter += f"id: {note['id']}\n"
        frontmatter += f"title: {note['title']}\n"
        frontmatter += f"type: {note['type']}\n"
        if note.get('tags'):
            tags_str = json.dumps(note['tags'])
            frontmatter += f"tags: {tags_str}\n"
        frontmatter += f"created_at: {note['created_at']}\n"
        frontmatter += f"updated_at: {note['updated_at']}\n"
        frontmatter += "---\n\n"

        # Markdown content
        content = f"# {note['title']}\n\n"
        content += note['content']

        return frontmatter + content

    def _markdown_to_note(self, markdown_text: str) -> Dict[str, Any]:
        """Parse Markdown text to note object"""
        # Extract YAML frontmatter
        frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', markdown_text, re.DOTALL)

        if not frontmatter_match:
            raise ValueError("Invalid note format: missing YAML frontmatter")

        frontmatter_text = frontmatter_match.group(1)
        content_start = frontmatter_match.end()

        # Parse frontmatter (simplified)
        note = {}
        for line in frontmatter_text.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()

                # Handle special fields
                if key == 'tags':
                    try:
                        note[key] = json.loads(value)
                    except:
                        note[key] = []
                else:
                    note[key] = value

        # Extract content (remove title line)
        markdown_content = markdown_text[content_start:].strip()
        lines = markdown_content.split('\n')
        if lines and lines[0].startswith('# '):
            markdown_content = '\n'.join(lines[1:]).strip()

        note['content'] = markdown_content

        # Add metadata
        note['metadata'] = {
            'word_count': len(markdown_content),
            'status': 'active'
        }

        return note

    def run(self, parameters: Dict[str, Any]) -> str:
        """Execute tool action"""
        if not self.validate_parameters(parameters):
            return "❌ Parameter validation failed"

        action = parameters.get("action")

        if action == "create":
            return self._create_note(parameters)
        elif action == "read":
            return self._read_note(parameters)
        elif action == "update":
            return self._update_note(parameters)
        elif action == "delete":
            return self._delete_note(parameters)
        elif action == "list":
            return self._list_notes(parameters)
        elif action == "search":
            return self._search_notes(parameters)
        elif action == "summary":
            return self._get_summary()
        else:
            return f"❌ Unsupported action: {action}"

    def get_parameters(self) -> List[ToolParameter]:
        """Get tool parameter definitions"""
        return [
            ToolParameter(
                name="action",
                type="string",
                description=(
                    "Action type: create, read, update, delete, list, search, summary"
                ),
                required=True
            ),
            ToolParameter(
                name="title",
                type="string",
                description="Note title (required for create/update)",
                required=False
            ),
            ToolParameter(
                name="content",
                type="string",
                description="Note content (required for create/update)",
                required=False
            ),
            ToolParameter(
                name="note_type",
                type="string",
                description=(
                    "Note type: task_state, conclusion, blocker, action, reference, general"
                ),
                required=False,
                default="general"
            ),
            ToolParameter(
                name="tags",
                type="array",
                description="List of tags (optional)",
                required=False
            ),
            ToolParameter(
                name="note_id",
                type="string",
                description="Note ID (required for read/update/delete)",
                required=False
            ),
            ToolParameter(
                name="query",
                type="string",
                description="Search keyword (required for search)",
                required=False
            ),
            ToolParameter(
                name="limit",
                type="integer",
                description="Result limit (default 10)",
                required=False,
                default=10
            ),
        ]

    def _create_note(self, params: Dict[str, Any]) -> str:
        """Create a new note"""
        title = params.get("title")
        content = params.get("content")
        note_type = params.get("note_type", "general")
        tags = params.get("tags", [])

        if not title or not content:
            return "❌ Title and content are required to create a note"

        # Check max note limit
        if len(self.notes_index["notes"]) >= self.max_notes:
            return f"❌ Maximum note limit reached ({self.max_notes})"

        # Generate note ID
        note_id = self._generate_note_id()

        # Create note object
        note = {
            "id": note_id,
            "title": title,
            "content": content,
            "type": note_type,
            "tags": tags if isinstance(tags, list) else [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "metadata": {
                "word_count": len(content),
                "status": "active"
            }
        }

        # Save to Markdown file
        note_path = self._get_note_path(note_id)
        markdown_content = self._note_to_markdown(note)
        with open(note_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        # Update index
        self.notes_index["notes"].append({
            "id": note_id,
            "title": title,
            "type": note_type,
            "tags": tags if isinstance(tags, list) else [],
            "created_at": note["created_at"]
        })
        self.notes_index["metadata"]["total_notes"] = len(self.notes_index["notes"])
        self._save_index()

        return f"✅ Note created successfully\nID: {note_id}\nTitle: {title}\nType: {note_type}"

    def _read_note(self, params: Dict[str, Any]) -> str:
        """Read a note by ID"""
        note_id = params.get("note_id")

        if not note_id:
            return "❌ Note ID is required to read a note"

        note_path = self._get_note_path(note_id)
        if not note_path.exists():
            return f"❌ Note not found: {note_id}"

        with open(note_path, 'r', encoding='utf-8') as f:
            markdown_text = f.read()

        note = self._markdown_to_note(markdown_text)

        return self._format_note(note)

    def _update_note(self, params: Dict[str, Any]) -> str:
        """Update an existing note"""
        note_id = params.get("note_id")

        if not note_id:
            return "❌ Note ID is required to update a note"

        note_path = self._get_note_path(note_id)
        if not note_path.exists():
            return f"❌ Note not found: {note_id}"

        # Load existing note
        with open(note_path, 'r', encoding='utf-8') as f:
            markdown_text = f.read()
        note = self._markdown_to_note(markdown_text)

        # Update fields
        if "title" in params:
            note["title"] = params["title"]
        if "content" in params:
            note["content"] = params["content"]
            note["metadata"]["word_count"] = len(params["content"])
        if "note_type" in params:
            note["type"] = params["note_type"]
        if "tags" in params:
            note["tags"] = params["tags"] if isinstance(params["tags"], list) else []

        note["updated_at"] = datetime.now().isoformat()

        # Save updated note
        markdown_content = self._note_to_markdown(note)
        with open(note_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        # Update index
        for idx_note in self.notes_index["notes"]:
            if idx_note["id"] == note_id:
                idx_note["title"] = note["title"]
                idx_note["type"] = note["type"]
                idx_note["tags"] = note["tags"]
                break
        self._save_index()

        return f"✅ Note updated successfully: {note_id}"

    def _delete_note(self, params: Dict[str, Any]) -> str:
        """Delete a note"""
        note_id = params.get("note_id")

        if not note_id:
            return "❌ Note ID is required to delete a note"

        note_path = self._get_note_path(note_id)
        if not note_path.exists():
            return f"❌ Note not found: {note_id}"

        # Delete file
        note_path.unlink()

        # Update index
        self.notes_index["notes"] = [
            n for n in self.notes_index["notes"] if n["id"] != note_id
        ]
        self.notes_index["metadata"]["total_notes"] = len(self.notes_index["notes"])
        self._save_index()

        return f"✅ Note deleted: {note_id}"

    def _list_notes(self, params: Dict[str, Any]) -> str:
        """List notes with optional filtering"""
        note_type = params.get("note_type")
        limit = params.get("limit", 10)

        # Filter notes
        filtered_notes = self.notes_index["notes"]
        if note_type:
            filtered_notes = [n for n in filtered_notes if n["type"] == note_type]

        # Apply limit
        filtered_notes = filtered_notes[:limit]

        if not filtered_notes:
            return "📝 No notes available"

        result = f"📝 Note List ({len(filtered_notes)} total)\n\n"
        for note in filtered_notes:
            result += f"• [{note['type']}] {note['title']}\n"
            result += f"  ID: {note['id']}\n"
            if note.get('tags'):
                result += f"  Tags: {', '.join(note['tags'])}\n"
            result += f"  Created: {note['created_at']}\n\n"

        return result

    def _search_notes(self, params: Dict[str, Any]) -> str:
        """Search notes by keyword"""
        query = params.get("query", "").lower()
        limit = params.get("limit", 10)

        if not query:
            return "❌ Search query is required"

        # Find matching notes
        matched_notes = []
        for idx_note in self.notes_index["notes"]:
            note_path = self._get_note_path(idx_note["id"])
            if note_path.exists():
                with open(note_path, 'r', encoding='utf-8') as f:
                    markdown_text = f.read()

                try:
                    note = self._markdown_to_note(markdown_text)
                except Exception as e:
                    print(f"⚠️ Failed to parse note {idx_note['id']}: {e}")
                    continue

                # Match title, content or tags
                if (query in note["title"].lower() or
                    query in note["content"].lower() or
                    any(query in tag.lower() for tag in note.get("tags", []))):
                    matched_notes.append(note)

        # Apply limit
        matched_notes = matched_notes[:limit]

        if not matched_notes:
            return f"📝 No notes matching '{query}'"

        result = f"🔍 Search Results ({len(matched_notes)} total)\n\n"
        for note in matched_notes:
            result += self._format_note(note, compact=True) + "\n"

        return result

    def _get_summary(self) -> str:
        """Get note statistics summary"""
        total = len(self.notes_index["notes"])

        # Count by type
        type_counts = {}
        for note in self.notes_index["notes"]:
            note_type = note["type"]
            type_counts[note_type] = type_counts.get(note_type, 0) + 1

        result = "📊 Note Summary\n\n"
        result += f"Total Notes: {total}\n\n"
        result += "By Type:\n"
        for note_type, count in sorted(type_counts.items()):
            result += f"  • {note_type}: {count}\n"

        return result

    def _format_note(self, note: Dict[str, Any], compact: bool = False) -> str:
        """Format note for output"""
        if compact:
            content_preview = note['content'][:100] + ("..." if len(note['content']) > 100 else "")
            return (
                f"[{note['type']}] {note['title']}\n"
                f"ID: {note['id']}\n"
                f"Content: {content_preview}"
            )
        else:
            result = "📝 Note Details\n\n"
            result += f"ID: {note['id']}\n"
            result += f"Title: {note['title']}\n"
            result += f"Type: {note['type']}\n"
            if note.get('tags'):
                result += f"Tags: {', '.join(note['tags'])}\n"
            result += f"Created: {note['created_at']}\n"
            result += f"Updated: {note['updated_at']}\n"
            result += f"\nContent:\n{note['content']}\n"
            return result
