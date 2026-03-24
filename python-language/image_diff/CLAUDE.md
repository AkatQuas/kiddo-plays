# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Python project for image diffing functionality. Currently in early development stage.

## Development Setup

**Python Version**: 3.12 (specified in `.python-version`)

**Virtual Environment**: The project uses a virtual environment in `.venv/`

Activate the virtual environment:

```bash
source .venv/bin/activate
```

**Dependencies**: Managed via `pyproject.toml`. Install with:

```bash
uv pip install -e ".[dev]"
```

## Running the Application

Execute the main script:

```bash
python main.py
```

## Project Structure

- `main.py` - Entry point with main() function
- `pyproject.toml` - Project metadata and dependencies
- `.python-version` - Python version specification (3.12)
