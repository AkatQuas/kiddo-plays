# Mac Screen OCR

Real-time screen OCR tool for macOS using RapidOCR and ONNX Runtime. This tool captures your screen and extracts text from it locally, without any internet or cloud dependencies.

## Features

- **100% Offline**: No internet or cloud dependencies
- **Real-time OCR**: Capture and process screen text in real-time
- **Local Processing**: Uses ONNX Runtime for CPU/GPU inference
- **Automatic Clipboard**: Results automatically copied to clipboard
- **Cross-platform**: Works on all Macs (MacBook, iMac, external displays)

## Requirements

- macOS in ARM CPU
- Python 3.12 or later
- [`uv`](https://docs.astral.sh/uv/) Python package manager

## Installation

Create virtual environment and install dependencies:

```bash
uv venv
source .venv/bin/activate
uv sync
```

## Usage

### Single Capture Mode

Run OCR on the current screen once:

```bash
python main.py
```

### Continuous Mode

Run OCR continuously (default interval 10 second):

```bash
python main.py --continuous
```

Specify custom interval (e.g., 20 seconds):

```bash
python main.py --continuous 20
```

## Output

The application provides three types of output:

1. **Console Output**: Clean, readable list of detected text with line numbers
2. **Clipboard Output**: All text automatically copied to your Mac clipboard (paste with `Cmd + V`)
3. **Structured Results**: Text content with bounding box coordinates (internal use)

## First Run

On first run, macOS may prompt you to grant Screen Recording permission:

1. Go to System Preferences > Security & Privacy > Privacy
2. Select "Screen Recording" from the left panel
3. Check the terminal app or IDE you're running the script from
4. Restart the script

## Dependencies

- `rapidocr` and `onnxruntime`: Core OCR engine with built-in ONNX Runtime
- `mss`: Low-latency screen capture
- `numpy`: Image format conversion
- `pyperclip`: Clipboard integration

## License

MIT
