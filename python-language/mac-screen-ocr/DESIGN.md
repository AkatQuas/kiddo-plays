# Mac 实时屏幕 OCR：RapidOCR + ONNX Runtime 实现方案

# Implementation Plan: Mac Real-Time Screen OCR with RapidOCR &amp; ONNX Runtime

## Full Offline Solution (No Cloud, No Internet, 100% Local)

This plan covers **capturing your Mac screen → running OCR via ONNX Runtime → outputting text** — production-ready, clear, and complete.

---

## 1. Project Initialization &amp; Dependencies (uv Managed)

This project uses **uv** (high-speed Python package &amp; environment manager) for full lifecycle management — including project initialization, venv virtual environment creation, dependency installation/versioning, and runtime isolation. All tools are offline, open-source, and no direct pip usage is required.

All dependencies are installed and locked via `uv`, with full reproducibility. Below is the dependency manifest and purpose:

| Package                      | Purpose                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `rapidocr` and `onnxruntime` | Core OCR engine + built-in ONNX Runtime (local CPU/GPU inference, no cloud) |
| `mss`                        | Low-latency Mac screen capture (in-memory, no temporary files)              |
| `numpy`                      | Image format conversion for OCR compatibility                               |
| `pyperclip`                  | Optional: Auto-copy OCR results to Mac clipboard                            |
| `opencv-python`              | Image preprocessing (auto-included with RapidOCR)                           |

### uv Workflow: Project Setup &amp; Dependency Installation

Ensure uv is installed and virtual environment is create, otherwise run these commands in Mac Terminal in sequence — **no pip commands are used**, full uv native management:

```bash
uv venv

# Activate the auto-created virtual environment
source .venv/bin/activate

# Install all dependencies via uv (locks versions automatically)
uv add rapidocr onnxruntime mss numpy pyperclip
```

---

## 2. Core Logic Steps (Step-by-Step)

The workflow is **simple, linear, and 100% local** — no external services.

### Step 1: Activate uv Environment &amp; Initialize OCR Engine

- Activate the uv-managed venv to ensure isolated, consistent dependencies

- Load pre-trained ONNX OCR models (text detection + recognition) locally

- Start ONNX Runtime inference session (runs entirely on Mac CPU/GPU)

- No internet, no cloud calls, no runtime model downloads

- Activate the **uv-managed venv virtual environment** to ensure dependency isolation

- Load **pre-trained ONNX models** (text detection + recognition)

- Start **ONNX Runtime** session locally on your Mac

- No internet, no cloud, no model download at runtime

- Load **pre-trained ONNX models** (text detection + recognition)

- Start **ONNX Runtime** session locally on your Mac

- No internet, no cloud, no model download at runtime

### Step 2: Capture Mac Screen (Real-Time)

- Use `mss` to capture the **full main screen** (instant, no file saved)

- Works on all Macs (MacBook, iMac, external displays)

- First run: grant **Screen Recording permission** (System Settings)

### Step 3: Image Format Conversion

- Convert raw screen data to a `numpy` array (required by RapidOCR)

- Remove transparent alpha channel (OCR only needs RGB)

### Step 4: Run OCR via ONNX Runtime

- Pass screen frame to RapidOCR

- **ONNX Runtime executes the OCR model locally** on your Mac CPU

- Detect text position → recognize characters → output structured results

### Step 5: Process &amp; Clean Results

- Extract only the **readable text** (ignore coordinates if desired)

- Optional: deduplicate repeated text

- Optional: sort text from top → bottom of screen

### Step 6: Generate Output

- Print text to console

- Auto-copy to Mac clipboard

- (Optional) Save to a text file

---

## 3. Input &amp; Output Definition

### Input

- **Real-time screen content** of your Mac (no manual screenshot files needed)

- No user input required during execution

### Output (Clear &amp; Defined)

You will get **3 types of output** (all local):

1. **Console Output**
   - Clean, readable list of detected text

   - Format: `[Line 1]`, `[Line 2]`, `[Line 3]`

2. **Clipboard Output**
   - All text automatically copied to your Mac clipboard

   - Paste directly with `Cmd + V`

3. **Structured OCR Result (Internal)**
   - Text content + bounding box coordinates (for advanced use)
