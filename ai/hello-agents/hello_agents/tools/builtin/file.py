"""File Operation Tools - With Optimistic Locking

Provides standard file read/write/edit capabilities:
- ReadTool: Read file + metadata caching
- WriteTool: Write file + conflict detection + atomic write
- EditTool: Precise replacement + conflict detection + backup
- MultiEditTool: Batch replacement + atomicity guarantee

Usage Example:
```python
from hello_agents import ToolRegistry
from hello_agents.tools.builtin import ReadTool, WriteTool, EditTool

registry = ToolRegistry()
registry.register_tool(ReadTool(project_root="./"))
registry.register_tool(WriteTool(project_root="./"))
registry.register_tool(EditTool(project_root="./"))
```
"""

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from ..base import Tool, ToolParameter
from ..errors import ToolErrorCode
from ..response import ToolResponse

if TYPE_CHECKING:
    from ..registry import ToolRegistry


class ReadTool(Tool):
    """File Read Tool

    Features:
    - Read file content (supports offset/limit)
    - List directory contents (when path is a directory)
    - Auto fetch file metadata (mtime, size)
    - Cache metadata to ToolRegistry (for optimistic locking)
    - Cross-platform compatible (Windows/Linux)

    Parameters:
    - path: File or directory path (relative to project_root)
    - offset: Starting line number (optional, default 0, file only)
    - limit: Max lines to read (optional, default 2000, file only)
    """

    def __init__(
        self,
        project_root: str = ".",
        working_dir: Optional[str] = None,
        registry: Optional['ToolRegistry'] = None
    ):
        super().__init__(
            name="Read",
            description="Read file content or list directory contents, supports line ranges and metadata caching",
            expandable=False
        )
        self.project_root = Path(project_root).resolve()
        self.working_dir = Path(working_dir).resolve() if working_dir else self.project_root
        self.registry = registry

    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter(
                name="path",
                type="string",
                description="File or directory path to read (relative to project root). If directory, list contents",
                required=True
            ),
            ToolParameter(
                name="offset",
                type="integer",
                description="Starting line number (0-based, only for file reading)",
                required=False,
                default=0
            ),
            ToolParameter(
                name="limit",
                type="integer",
                description="Maximum lines to read (only for file reading)",
                required=False,
                default=2000
            )
        ]

    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute file read or directory listing"""
        path = parameters.get("path")
        offset = parameters.get("offset", 0)
        limit = parameters.get("limit", 2000)

        if not path:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: path"
            )

        try:
            # Resolve path
            full_path = self._resolve_path(path)

            if not full_path.exists():
                return ToolResponse.error(
                    code=ToolErrorCode.NOT_FOUND,
                    message=f"Path '{path}' does not exist"
                )

            # If directory, return directory listing
            if full_path.is_dir():
                return self._list_directory(path, full_path)

            # Read file
            with open(full_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Apply offset and limit
            total_lines = len(lines)
            if offset > 0:
                lines = lines[offset:]
            if limit > 0:
                lines = lines[:limit]

            content = ''.join(lines)

            # Get file metadata (for optimistic locking)
            mtime = os.path.getmtime(full_path)
            size = os.path.getsize(full_path)
            file_mtime_ms = int(mtime * 1000)
            file_size_bytes = size

            # Cache metadata to ToolRegistry
            if self.registry:
                self.registry.cache_read_metadata(path, {
                    "file_mtime_ms": file_mtime_ms,
                    "file_size_bytes": file_size_bytes
                })

            return ToolResponse.success(
                text=f"Read {len(lines)} lines (total {total_lines} lines, {file_size_bytes} bytes)",
                data={
                    "content": content,
                    "lines": len(lines),
                    "total_lines": total_lines,
                    "file_mtime_ms": file_mtime_ms,
                    "file_size_bytes": file_size_bytes,
                    "offset": offset,
                    "limit": limit
                }
            )

        except PermissionError:
            return ToolResponse.error(
                code=ToolErrorCode.PERMISSION_DENIED,
                message=f"Permission denied to read '{path}'"
            )
        except Exception as e:
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Failed to read file: {str(e)}"
            )

    def _list_directory(self, path: str, full_path: Path) -> ToolResponse:
        """List directory contents (Windows/Linux compatible)"""
        try:
            entries = []
            total_files = 0
            total_dirs = 0

            # Get all entries in directory
            for entry in sorted(full_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                try:
                    # Get entry info
                    is_dir = entry.is_dir()
                    name = entry.name

                    # Get size and modification time
                    if is_dir:
                        size_str = "<DIR>"
                        total_dirs += 1
                    else:
                        try:
                            size = entry.stat().st_size
                            size_str = self._format_size(size)
                            total_files += 1
                        except:
                            size_str = "?"

                    # Get modification time
                    try:
                        mtime = entry.stat().st_mtime
                        mtime_str = self._format_time(mtime)
                    except:
                        mtime_str = "?"

                    # Use forward slash as path separator (cross-platform)
                    relative_path = str(entry.relative_to(self.project_root)).replace(os.sep, '/')

                    entries.append({
                        "name": name,
                        "type": "directory" if is_dir else "file",
                        "size": size_str,
                        "mtime": mtime_str,
                        "path": relative_path
                    })
                except Exception:
                    # Skip inaccessible entries
                    continue

            # Build output text
            if not entries:
                text = f"Directory '{path}' is empty"
            else:
                lines = [f"Directory '{path}' contains {total_files} files, {total_dirs} directories:\n"]
                for entry in entries:
                    type_icon = "📁" if entry["type"] == "directory" else "📄"
                    lines.append(f"{type_icon} {entry['name']:<40} {entry['size']:>10} {entry['mtime']}")
                text = "\n".join(lines)

            return ToolResponse.success(
                text=text,
                data={
                    "path": path,
                    "entries": entries,
                    "total_files": total_files,
                    "total_dirs": total_dirs,
                    "is_directory": True
                }
            )
        except PermissionError:
            return ToolResponse.error(
                code=ToolErrorCode.ACCESS_DENIED,
                message=f"Access denied to directory '{path}'"
            )
        except Exception as e:
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Failed to list directory: {str(e)}"
            )

    def _format_size(self, size: float) -> str:
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f}{unit}"
            size /= 1024.0
        return f"{size:.1f}TB"

    def _format_time(self, timestamp: float) -> str:
        """Format timestamp (Windows/Linux compatible)"""
        dt = datetime.fromtimestamp(timestamp)
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def _resolve_path(self, path: str) -> Path:
        """Resolve relative path (Windows/Linux compatible)"""
        # Normalize path separators: backslash to forward slash
        path = path.replace('\\', '/')

        # Use absolute path directly if provided
        if os.path.isabs(path):
            return Path(path)

        # Otherwise relative to working_dir
        return self.working_dir / path


class WriteTool(Tool):
    """File Write Tool

    Features:
    - Create or overwrite file
    - Optimistic lock conflict detection (if file exists)
    - Atomic write (temp file + rename)
    - Auto backup original file

    Parameters:
    - path: File path
    - content: File content
    - file_mtime_ms: Cached mtime (optional, for conflict detection)
    """

    def __init__(
        self,
        project_root: str = ".",
        working_dir: Optional[str] = None,
        registry: Optional['ToolRegistry'] = None
    ):
        super().__init__(
            name="Write",
            description="Create or overwrite file, supports conflict detection and atomic write",
            expandable=False
        )
        self.project_root = Path(project_root).resolve()
        self.working_dir = Path(working_dir).resolve() if working_dir else self.project_root
        self.registry = registry

    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter(
                name="path",
                type="string",
                description="File path (relative to project root)",
                required=True
            ),
            ToolParameter(
                name="content",
                type="string",
                description="File content",
                required=True
            ),
            ToolParameter(
                name="file_mtime_ms",
                type="integer",
                description="Cached file modification time (for conflict detection)",
                required=False
            )
        ]

    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute file write"""
        path = parameters.get("path")
        content = parameters.get("content")
        cached_mtime = parameters.get("file_mtime_ms")

        if not path:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: path"
            )

        if content is None:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: content"
            )

        try:
            # Resolve path
            full_path = self._resolve_path(path)
            backup_path = None

            # Check if file exists
            if full_path.exists():
                # Get current file metadata
                current_mtime = os.path.getmtime(full_path)
                current_mtime_ms = int(current_mtime * 1000)

                # Check optimistic lock conflict
                if cached_mtime is not None:
                    if current_mtime_ms != cached_mtime:
                        return ToolResponse.error(
                            code=ToolErrorCode.CONFLICT,
                            message=f"File modified since last read. Current mtime={current_mtime_ms}, Cached mtime={cached_mtime}",
                            context={
                                "current_mtime_ms": current_mtime_ms,
                                "cached_mtime_ms": cached_mtime
                            }
                        )

                # Backup original file
                backup_path = self._backup_file(full_path)
            else:
                # Ensure parent directory exists
                full_path.parent.mkdir(parents=True, exist_ok=True)

            # Atomic write (temp file + rename)
            temp_path = full_path.with_suffix(full_path.suffix + '.tmp')
            with open(temp_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Atomic rename
            os.replace(temp_path, full_path)

            size_bytes = len(content.encode('utf-8'))

            return ToolResponse.success(
                text=f"Successfully wrote to {path} ({size_bytes} bytes)",
                data={
                    "written": True,
                    "size_bytes": size_bytes,
                    "backup_path": str(backup_path.relative_to(self.working_dir)) if backup_path else None
                }
            )

        except PermissionError:
            return ToolResponse.error(
                code=ToolErrorCode.PERMISSION_DENIED,
                message=f"Permission denied to write '{path}'"
            )
        except Exception as e:
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Failed to write file: {str(e)}"
            )

    def _backup_file(self, full_path: Path) -> Path:
        """Backup file"""
        backup_dir = full_path.parent / ".backups"
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{full_path.name}.{timestamp}.bak"
        backup_path = backup_dir / backup_name

        shutil.copy2(full_path, backup_path)
        return backup_path

    def _resolve_path(self, path: str) -> Path:
        """Resolve relative path"""
        if os.path.isabs(path):
            return Path(path)
        return self.working_dir / path


class EditTool(Tool):
    """File Edit Tool

    Features:
    - Precise content replacement (old_string must match uniquely)
    - Optimistic lock conflict detection
    - Auto backup original file

    Parameters:
    - path: File path
    - old_string: Content to replace
    - new_string: Replacement content
    - file_mtime_ms: Cached mtime (optional)
    """

    def __init__(
        self,
        project_root: str = ".",
        working_dir: Optional[str] = None,
        registry: Optional['ToolRegistry'] = None
    ):
        super().__init__(
            name="Edit",
            description="Precisely replace file content, supports conflict detection and auto backup",
            expandable=False
        )
        self.project_root = Path(project_root).resolve()
        self.working_dir = Path(working_dir).resolve() if working_dir else self.project_root
        self.registry = registry

    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter(
                name="path",
                type="string",
                description="File path to edit (relative to project root)",
                required=True
            ),
            ToolParameter(
                name="old_string",
                type="string",
                description="Content to replace (must match uniquely)",
                required=True
            ),
            ToolParameter(
                name="new_string",
                type="string",
                description="Replacement content",
                required=True
            ),
            ToolParameter(
                name="file_mtime_ms",
                type="integer",
                description="Cached file modification time (for conflict detection)",
                required=False
            )
        ]

    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute file edit"""
        path = parameters.get("path")
        old_string = parameters.get("old_string")
        new_string = parameters.get("new_string")
        cached_mtime = parameters.get("file_mtime_ms")

        if not path:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: path"
            )

        if old_string is None:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: old_string"
            )

        if new_string is None:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: new_string"
            )

        try:
            # Resolve path
            full_path = self._resolve_path(path)

            if not full_path.exists():
                return ToolResponse.error(
                    code=ToolErrorCode.NOT_FOUND,
                    message=f"File '{path}' does not exist"
                )

            # Get current file metadata
            current_mtime = os.path.getmtime(full_path)
            current_mtime_ms = int(current_mtime * 1000)

            # Check optimistic lock conflict
            if cached_mtime is not None and current_mtime_ms != cached_mtime:
                return ToolResponse.error(
                    code=ToolErrorCode.CONFLICT,
                    message=f"File modified since last read. Current mtime={current_mtime_ms}, Cached mtime={cached_mtime}",
                    context={
                        "current_mtime_ms": current_mtime_ms,
                        "cached_mtime_ms": cached_mtime
                    }
                )

            # Read file content
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check unique match for old_string
            matches = content.count(old_string)
            if matches != 1:
                return ToolResponse.error(
                    code=ToolErrorCode.INVALID_PARAM,
                    message=f"old_string must match uniquely. Found {matches} matches.",
                    context={"matches": matches}
                )

            # Perform replacement
            new_content = content.replace(old_string, new_string)

            # Backup original file
            backup_path = self._backup_file(full_path)

            # Write new content
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)

            changed_bytes = len(new_string.encode('utf-8')) - len(old_string.encode('utf-8'))

            return ToolResponse.success(
                text=f"Successfully edited {path} (changed {changed_bytes:+d} bytes)",
                data={
                    "modified": True,
                    "changed_bytes": changed_bytes,
                    "backup_path": str(backup_path.relative_to(self.working_dir))
                }
            )

        except PermissionError:
            return ToolResponse.error(
                code=ToolErrorCode.PERMISSION_DENIED,
                message=f"Permission denied to edit '{path}'"
            )
        except Exception as e:
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Failed to edit file: {str(e)}"
            )

    def _backup_file(self, full_path: Path) -> Path:
        """Backup file"""
        backup_dir = full_path.parent / ".backups"
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{full_path.name}.{timestamp}.bak"
        backup_path = backup_dir / backup_name

        shutil.copy2(full_path, backup_path)
        return backup_path

    def _resolve_path(self, path: str) -> Path:
        """Resolve relative path"""
        if os.path.isabs(path):
            return Path(path)
        return self.working_dir / path


class MultiEditTool(Tool):
    """Batch Edit Tool

    Features:
    - Execute multiple replace operations in batch
    - Atomicity guarantee (all succeed or all fail)
    - Optimistic lock conflict detection (single check before all replaces)

    Parameters:
    - path: File path
    - edits: Replace list [{"old_string": "...", "new_string": "..."}]
    - file_mtime_ms: Cached mtime (optional)
    """

    def __init__(
        self,
        project_root: str = ".",
        working_dir: Optional[str] = None,
        registry: Optional['ToolRegistry'] = None
    ):
        super().__init__(
            name="MultiEdit",
            description="Batch replace file content, supports atomicity and conflict detection",
            expandable=False
        )
        self.project_root = Path(project_root).resolve()
        self.working_dir = Path(working_dir).resolve() if working_dir else self.project_root
        self.registry = registry

    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter(
                name="path",
                type="string",
                description="File path to edit (relative to project root)",
                required=True
            ),
            ToolParameter(
                name="edits",
                type="array",
                description="List of edits, each containing old_string and new_string",
                required=True
            ),
            ToolParameter(
                name="file_mtime_ms",
                type="integer",
                description="Cached file modification time (for conflict detection)",
                required=False
            )
        ]

    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """Execute batch edit"""
        path = parameters.get("path")
        edits = parameters.get("edits")
        cached_mtime = parameters.get("file_mtime_ms")

        if not path:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: path"
            )

        if not edits or not isinstance(edits, list):
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Missing required parameter: edits (must be a list)"
            )

        try:
            # Resolve path
            full_path = self._resolve_path(path)

            if not full_path.exists():
                return ToolResponse.error(
                    code=ToolErrorCode.NOT_FOUND,
                    message=f"File '{path}' does not exist"
                )

            # Get current file metadata
            current_mtime = os.path.getmtime(full_path)
            current_mtime_ms = int(current_mtime * 1000)

            # Check optimistic lock conflict (single check before all replaces)
            if cached_mtime is not None and current_mtime_ms != cached_mtime:
                return ToolResponse.error(
                    code=ToolErrorCode.CONFLICT,
                    message=f"File modified since last read. All edits canceled. Current mtime={current_mtime_ms}, Cached mtime={cached_mtime}",
                    context={
                        "current_mtime_ms": current_mtime_ms,
                        "cached_mtime_ms": cached_mtime
                    }
                )

            # Read file content
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            original_content = content

            # Validate all edit operations
            for i, edit in enumerate(edits):
                old_string = edit.get("old_string")
                new_string = edit.get("new_string")

                if old_string is None or new_string is None:
                    return ToolResponse.error(
                        code=ToolErrorCode.INVALID_PARAM,
                        message=f"Edit item {i} missing old_string or new_string"
                    )

                # Check unique match
                matches = content.count(old_string)
                if matches != 1:
                    return ToolResponse.error(
                        code=ToolErrorCode.INVALID_PARAM,
                        message=f"Edit item {i}: old_string must match uniquely. Found {matches} matches.",
                        context={"edit_index": i, "matches": matches}
                    )

            # Perform all replaces (atomic)
            for edit in edits:
                content = content.replace(edit["old_string"], edit["new_string"])

            # Backup original file
            backup_path = self._backup_file(full_path)

            # Write new content
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            changed_bytes = len(content.encode('utf-8')) - len(original_content.encode('utf-8'))

            return ToolResponse.success(
                text=f"Successfully executed {len(edits)} replace operations (changed {changed_bytes:+d} bytes)",
                data={
                    "modified": True,
                    "num_edits": len(edits),
                    "changed_bytes": changed_bytes,
                    "backup_path": str(backup_path.relative_to(self.working_dir))
                }
            )

        except PermissionError:
            return ToolResponse.error(
                code=ToolErrorCode.PERMISSION_DENIED,
                message=f"Permission denied to edit '{path}'"
            )
        except Exception as e:
            return ToolResponse.error(
                code=ToolErrorCode.INTERNAL_ERROR,
                message=f"Batch edit failed: {str(e)}"
            )

    def _backup_file(self, full_path: Path) -> Path:
        """Backup file"""
        backup_dir = full_path.parent / ".backups"
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{full_path.name}.{timestamp}.bak"
        backup_path = backup_dir / backup_name

        shutil.copy2(full_path, backup_path)
        return backup_path

    def _resolve_path(self, path: str) -> Path:
        """Resolve relative path"""
        if os.path.isabs(path):
            return Path(path)
        return self.working_dir / path
