import struct
import sys
from pathlib import Path

from PIL import Image


def bgr555_to_rgb(color16):
    r = (color16 & 0x1F) << 3
    g = ((color16 >> 5) & 0x1F) << 3
    b = ((color16 >> 10) & 0x1F) << 3
    return (r, g, b)

def load_palette_pal(pal_path: Path):
    data = pal_path.read_bytes()
    # palette entries are 2-byte little-endian BGR555
    colors = []
    for i in range(0, len(data), 2):
        val = struct.unpack_from("<H", data, i)[0]
        colors.append(bgr555_to_rgb(val))
    return colors

def decode_4bpp_tile(tile_bytes):
    # Assumes linear nibble order: each byte = low nibble pixel0, high nibble pixel1.
    # Tile_bytes length 32: 8 rows * 4 bytes per row => 8 pixels per row
    pixels = []
    for row in range(8):
        row_bytes = tile_bytes[row*4:(row+1)*4]
        row_pixels = []
        for b in row_bytes:
            row_pixels.append(b & 0x0F)
            row_pixels.append((b >> 4) & 0x0F)
        pixels.extend(row_pixels[:8])
    return pixels  # length 64

def raw_indexed_to_image(data: bytes, width: int, height: int, bpp: int, palette=None):
    pixels = []
    if bpp == 8:
        # linear indexed
        pixels = list(data[:width*height])
    elif bpp == 4:
        # assume tiled 8x8 tiles, tiles laid out sequentially left-to-right, top-to-bottom
        tiles_per_row = width // 8
        tiles_per_col = height // 8
        tile_count = tiles_per_row * tiles_per_col
        for ty in range(tiles_per_col):
            for tx in range(tiles_per_row):
                idx = (ty*tiles_per_row + tx) * 32
                tile = data[idx:idx+32]
                tpx = decode_4bpp_tile(tile)
                # place tile pixels into image buffer
                for y in range(8):
                    for x in range(8):
                        px = tpx[y*8 + x]
                        px_x = tx*8 + x
                        px_y = ty*8 + y
                        pixels.append((px_x, px_y, px))
        # rearrange into row-major array
        arr = [0]*(width*height)
        for (x,y,val) in pixels:
            arr[y*width + x] = val
        pixels = arr
    else:
        raise ValueError("Unsupported bpp")
    # build image (indexed) then convert using palette to RGB
    img = Image.new("P", (width, height))
    img.putdata(pixels)
    if palette:
        # palette: list of (r,g,b)
        flat = []
        for c in palette:
            flat.extend(c)
        # Pillow expects 768-length palette for 'P' images (256 colors)
        flat += [0]*(768 - len(flat))
        img.putpalette(flat)
        img = img.convert("RGB")
    return img

if __name__ == "__main__":
    # Usage: python raw_to_png.py data.bin width height bpp palette.pal out.png
    _, path, w, h, bpp, pal, out = sys.argv
    p = Path(path)
    data = p.read_bytes()
    palette = load_palette_pal(Path(pal)) if pal != "none" else None
    img = raw_indexed_to_image(data, int(w), int(h), int(bpp), palette)
    img.save(out)
    print("Saved", out)
