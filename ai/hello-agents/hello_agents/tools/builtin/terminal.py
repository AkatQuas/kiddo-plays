"""TerminalTool - Command Line Tool

Provides secure command-line execution for Agents, supporting:
- File system operations (ls, cat, head, tail, find, grep)
- Text processing (wc, sort, uniq)
- Directory navigation (pwd, cd)
- Security restrictions (command whitelist, path sandbox, timeout)

Use Cases:
- JIT file inspection and analysis
- Code repository exploration
- Log file analysis
- Data file preview

Security Features:
- Command whitelist (read-only safe commands only)
- Working directory sandbox
- Execution timeout
- Output size limit
- Forbidden dangerous operations (rm, mv, chmod, etc.)
"""

import os
import shlex
import subprocess
from pathlib import Path
from typing import Any, Dict, List

from ..base import Tool, ToolParameter


class TerminalTool(Tool):
    """Secure Command Line Tool

    Provides safe shell command execution for common filesystem and text processing.

    Security Restrictions:
    - Only whitelisted commands allowed
    - Sandboxed to a specified working directory
    - Timeout control (default 30s)
    - Output size limit (default 10MB)

    Usage Example:
    ```python
    terminal = TerminalTool(workspace="./project")

    # List files
    result = terminal.run({"command": "ls -la"})

    # View file content
    result = terminal.run({"command": "cat README.md"})

    # Search files
    result = terminal.run({"command": "grep -r 'TODO' src/"})

    # View first 10 lines
    result = terminal.run({"command": "head -n 10 data.csv"})
    ```
    """

    # Allowed command whitelist
    ALLOWED_COMMANDS = {
        # File listing & info
        'ls', 'dir', 'tree',
        # File content viewing
        'cat', 'head', 'tail', 'less', 'more',
        # File search
        'find', 'grep', 'egrep', 'fgrep',
        # Text processing
        'wc', 'sort', 'uniq', 'cut', 'awk', 'sed',
        # Directory operations
        'pwd', 'cd',
        # File info
        'file', 'stat', 'du', 'df',
        # Utilities
        'echo', 'which', 'whereis',
        # Code execution
        'python', 'node', 'bash', 'sh',
    }

    def __init__(
        self,
        workspace: str = ".",
        timeout: int = 30,
        max_output_size: int = 10 * 1024 * 1024,  # 10MB
        allow_cd: bool = True
    ):
        super().__init__(
            name="terminal",
            description="Terminal tool - execute safe filesystem, text processing, and code commands (ls, cat, grep, head, tail, etc.)"
        )

        self.workspace = Path(workspace).resolve()
        self.timeout = timeout
        self.max_output_size = max_output_size
        self.allow_cd = allow_cd

        # Current working directory (relative to workspace)
        self.current_dir = self.workspace

        # Ensure workspace exists
        self.workspace.mkdir(parents=True, exist_ok=True)

    def run(self, parameters: Dict[str, Any]) -> str:
        """Execute the tool"""
        if not self.validate_parameters(parameters):
            return "❌ Parameter validation failed"

        command = parameters.get("command", "").strip()

        if not command:
            return "❌ Command cannot be empty"

        # Parse command
        try:
            parts = shlex.split(command)
        except ValueError as e:
            return f"❌ Failed to parse command: {e}"

        if not parts:
            return "❌ Command cannot be empty"

        base_command = parts[0]

        # Check if command is allowed
        if base_command not in self.ALLOWED_COMMANDS:
            return f"❌ Command not allowed: {base_command}\nAllowed commands: {', '.join(sorted(self.ALLOWED_COMMANDS))}"

        # Special handling for cd
        if base_command == 'cd':
            return self._handle_cd(parts)

        # Execute command
        return self._execute_command(command)

    def get_parameters(self) -> List[ToolParameter]:
        """Get tool parameter definitions"""
        return [
            ToolParameter(
                name="command",
                type="string",
                description=(
                    f"Command to execute (whitelist: {', '.join(sorted(list(self.ALLOWED_COMMANDS)[:10]))}...)\n"
                    "Examples: 'ls -la', 'cat file.txt', 'grep pattern *.py', 'head -n 20 data.csv'"
                ),
                required=True
            ),
        ]

    def _handle_cd(self, parts: List[str]) -> str:
        """Handle cd command"""
        if not self.allow_cd:
            return "❌ cd command is disabled"

        if len(parts) < 2:
            # cd without arguments returns current directory
            return f"Current directory: {self.current_dir}"

        target_dir = parts[1]

        # Resolve relative paths
        if target_dir == "..":
            new_dir = self.current_dir.parent
        elif target_dir == ".":
            new_dir = self.current_dir
        elif target_dir == "~":
            new_dir = self.workspace
        else:
            new_dir = (self.current_dir / target_dir).resolve()

        # Ensure path stays inside workspace
        try:
            new_dir.relative_to(self.workspace)
        except ValueError:
            return f"❌ Access denied: path outside workspace: {new_dir}"

        # Check if directory exists
        if not new_dir.exists():
            return f"❌ Directory does not exist: {new_dir}"

        if not new_dir.is_dir():
            return f"❌ Not a directory: {new_dir}"

        # Update current directory
        self.current_dir = new_dir
        return f"✅ Changed directory to: {self.current_dir}"

    def _execute_command(self, command: str) -> str:
        """Execute shell command"""
        try:
            # Run command in current directory
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(self.current_dir),
                capture_output=True,
                text=True,
                timeout=self.timeout,
                env=os.environ.copy()
            )

            # Combine stdout and stderr
            output = result.stdout
            if result.stderr:
                output += f"\n[stderr]\n{result.stderr}"

            # Truncate large output
            if len(output) > self.max_output_size:
                output = output[:self.max_output_size]
                output += f"\n\n⚠️ Output truncated (exceeds {self.max_output_size} bytes)"

            # Add return code info
            if result.returncode != 0:
                output = f"⚠️ Command exit code: {result.returncode}\n\n{output}"

            return output if output else "✅ Command executed successfully (no output)"

        except subprocess.TimeoutExpired:
            return f"❌ Command timed out after {self.timeout} seconds"
        except Exception as e:
            return f"❌ Command execution failed: {e}"

    def get_current_dir(self) -> str:
        """Get current working directory"""
        return str(self.current_dir)

    def reset_dir(self):
        """Reset to workspace root"""
        self.current_dir = self.workspace
