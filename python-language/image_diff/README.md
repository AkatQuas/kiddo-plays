# Image Diff

A Python CLI tool for comparing two PNG images pixel-by-pixel and visualizing the differences.

> Co work with Claude.

## Features

- **Pixel-by-pixel comparison** - Detects even single-pixel differences between images
- **Multiple visualization modes** - Choose from highlight, grayscale, heatmap, or side-by-side views
- **Detailed statistics** - Get comprehensive metrics about image differences
- **Threshold support** - Ignore minor differences below a specified threshold
- **Dimension validation** - Ensures images have matching dimensions before comparison

## Installation

1. Ensure you have Python 3.12 or higher installed
2. Clone this repository
3. Install dependencies:

```bash
source .venv/bin/activate
uv pip install -e ".[dev]"
```

## Usage

### Basic Usage

Compare two images with default settings (highlight mode):

```bash
python main.py image1.png image2.png
```

This creates `diff_result.png` showing differences highlighted in red.

### Custom Output Path

Specify a custom output file:

```bash
python main.py image1.png image2.png -o my_diff.png
```

### Visualization Modes

Choose different visualization modes with the `-m` or `--mode` flag:

**Highlight Mode (default)** - Shows the first image with differences highlighted in red:

```bash
python main.py image1.png image2.png -m highlight
```

**Grayscale Mode** - Shows differences as a grayscale map (white = different, black = same):

```bash
python main.py image1.png image2.png -m grayscale
```

**Heatmap Mode** - Shows differences as a color gradient (blue = same, red = different):

```bash
python main.py image1.png image2.png -m heatmap
```

**Side-by-Side Mode** - Shows three panels: original1 | original2 | difference:

```bash
python main.py image1.png image2.png -m side-by-side
```

### Threshold

Ignore small differences below a threshold (0-255):

```bash
python main.py image1.png image2.png --threshold 10
```

This treats pixel differences less than 10 as identical, useful for ignoring compression artifacts or minor variations.

### Complete Example

```bash
python main.py photo1.png photo2.png -o comparison.png -m heatmap --threshold 5
```

## Output

The tool provides detailed statistics on stdout:

```
Comparison Results:
  Total pixels: 2,073,600
  Different pixels: 45,231
  Identical pixels: 2,028,369
  Difference: 2.18%
  Max difference: 255
  Mean difference: 12.34

Difference image saved to: diff_result.png
```

## Error Handling

The tool provides clear error messages for common issues:

- **File not found**: `Error: Image file not found: image1.png`
- **Invalid PNG**: `Error: File is not a PNG image: image.jpg (format: JPEG)`
- **Size mismatch**: `Error: Image dimensions don't match: (1920, 1080) vs (1280, 720)`

## Development

### Running Tests

Run the test suite with pytest:

```bash
pytest tests/ -v
```

Run tests with coverage:

```bash
pytest tests/ -v --cov
```

### Project Structure

```
image_diff/
├── main.py              # Main application code
├── tests/
│   └── test_comparator.py  # Test suite
├── pyproject.toml       # Project dependencies
├── README.md            # This file
└── .python-version      # Python version (3.12)
```

## Requirements

- Python >= 3.12
- Pillow >= 10.0.0
- NumPy >= 1.24.0

## License

This project is open source and available for use.

## Contributing

Contributions are welcome! Please ensure all tests pass before submitting changes.
