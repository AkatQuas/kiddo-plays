import sys
from pathlib import Path


def replace_text_preserve_length(path: str, old_text: str, new_text: str, encoding="shift_jis"):
    p = Path(path)
    data = p.read_bytes()
    old_b = old_text.encode(encoding)
    new_b = new_text.encode(encoding)
    if len(new_b) > len(old_b):
        raise SystemExit(f"New text too long: {len(new_b)} > {len(old_b)}")
    new_b = new_b.ljust(len(old_b), b"\x00")
    new_data = data.replace(old_b, new_b)
    if new_data is data:
        raise SystemExit("Pattern not found")
    p.write_bytes(new_data)
    print(f"Replaced text in {p} (encoding={encoding})")

if __name__ == "__main__":
    # Usage: python text_replace.py file.bin "old" "new" [encoding]
    _, path, old, new, *rest = sys.argv
    enc = rest[0] if rest else "shift_jis"
    replace_text_preserve_length(path, old, new, enc)
