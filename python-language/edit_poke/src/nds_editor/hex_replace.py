import sys
from pathlib import Path


def replace_bytes(path: str, offset: int, hexdata: str):
    p = Path(path)
    data = bytes.fromhex(hexdata)
    with p.open("r+b") as f:
        f.seek(offset)
        f.write(data)
    print(f"Wrote {len(data)} bytes at 0x{offset:x} in {p}")

if __name__ == "__main__":
    _, path, off, hexdata = sys.argv
    replace_bytes(path, int(off, 0), hexdata)
