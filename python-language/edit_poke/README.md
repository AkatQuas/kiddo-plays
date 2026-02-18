# NDS ROM Editor (macOS example)

Small demo project that provides a thin wrapper around `ndspy` to load,
extract, replace and save Nintendo DS ROM files on macOS. This project
includes a minimal example runner in [main.py](main.py) and the editor
implementation in [src/nds_editor/core.py](src/nds_editor/core.py).

**Files**

- [src/nds_editor/core.py](src/nds_editor/core.py): NDSRomEditor class — load, extract, replace, edit text, save.
- [main.py](main.py): Example script demonstrating usage (expects a ROM on macOS Desktop named SoulSilver.nds).

**Requirements**

- Python 3.8+
- ndspy (install via pip)

## Installation

```bash
uv venv
source .venv/bin/activate
uv sync
```

## Quick start

1. Place your ROM file on macOS Desktop (example name used by `main.py`: `SoulSilver.nds`).
2. Run the demo:

```bash
python main.py
```

## API Notes / Examples

- Extract all files (writes to `~/Desktop/nds_extracted` by default): see [src/nds_editor/core.py](src/nds_editor/core.py#L22-L45)
- Replace a file inside the ROM:

```python
from src.nds_editor.core import NDSRomEditor
e = NDSRomEditor("SoulSilver.nds")
e.replace_file("data/graphics/pokemon.bin", "modified_pokemon.bin")
e.save_rom("SoulSilver_modded.nds")
```

- Edit text inside a ROM file (encoding/length constraints apply): see `edit_text` in [src/nds_editor/core.py](src/nds_editor/core.py#L64-L99)

# Notes

- This is a macOS-focused demo — helper utilities assume Desktop paths.
- Be careful when replacing or modifying files inside ROMs; backups are recommended.

# License

No license specified — treat this as a small demo snippet
