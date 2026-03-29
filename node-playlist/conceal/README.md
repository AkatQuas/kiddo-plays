# Conceal

A command-line tool for creating password-protected ZIP archives with optional PNG image steganography.

## Overview

Conceal packages files into encrypted ZIP archives and can hide them inside PNG images using least-significant-bit (LSB) steganography, providing an additional layer of obfuscation for secure file transfer.

## Features

### Password-Protected ZIP Creation

- Compress directories into encrypted ZIP files
- Generates strong passwords with mixed characters (letters, numbers)
- Maximum compression level (`-9` flag)
- Automatic exclusion of `node_modules` directory

### Smart File Naming

Automatically generates contextually appropriate filenames based on file type:

| Type | Output Pattern | Example |
|------|----------------|---------|
| `record` | Screen Recording YYYY-MM-DD at hh.mm.ss.mov | Screen Recording 2022-07-07 at 09.42.14.mov |
| `shot` | Screen Shot YYYY-MM-DD at hh.mm.ss.png | Screen Shot 2022-07-27 at 17.25.30.png |
| `phone_record` | RPReplay_Final{timestamp}.MP4 | RPReplay_Final1662538044.MP4 |

When no type is specified, randomly selects between `record` and `shot`.

### Bing Wallpaper Integration (`conceal_strong.mjs`)

- Downloads the daily Bing wallpaper automatically
- Resizes and composites the wallpaper with proper padding
- Embeds the ZIP archive directly into the PNG image

### Steganography Encoding ([steganography](https://github.com/7thSamurai/steganography))

- Hides encrypted ZIP data inside PNG images using LSB encoding
- Password-protects the embedded data
- Outputs a visually identical PNG that contains hidden content

## Installation

```bash
# Install dependencies
pnpm install

# Build the steganography encoder (required for conceal_strong.mjs)
make build-steganography
```

## Usage

### Basic Usage (`conceal.mjs`)

Create a password-protected ZIP with a screen shot-style filename:

```bash
node conceal.mjs --dir /path/to/directory --type shot
```

### Steganography Mode (`conceal_strong.mjs`)

Create a hidden ZIP inside a Bing wallpaper:

```bash
node conceal_strong.mjs --dir /path/to/directory --type record
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--dir` | Yes | Absolute path to directory to compress |
| `--type` | No | File type: `shot`, `record`, `phone_record` |

### Output

The tool outputs the generated password and file location to the console:

```
 --- pw ---
 {
   pw: 'abcd1234#efgh5678@ijkl9012%mnop3456',
   output: '/Users/user/Desktop/Screen Shot 2022-07-27 at 17.25.30.png'
 }
```

## Password Generation

- Generates 100 random character candidates (8 chars each)
- Randomly selects 4 candidates
- Joins with special characters: `#`, `@`, `%`
- Result format: `{8chars}#{8chars}@{8chars}%{8chars}` (32 characters total)

## Project Structure

```
conceal/
├── conceal.mjs              # Basic password-protected ZIP tool
├── conceal_strong.mjs       # Steganography-enabled version
├── lib/
│   └── wallpaper.mjs      # Bing wallpaper downloader
├── test/
│   └── detect-ft.mjs      # File type detection tests
├── scripts/
│   ├── build-steganography.sh  # Build script for steganography encoder
│   └── steganography/     # Source code for steganography encoder
├── steganography          # Compiled steganography binary
└── package.json
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [zx](https://github.com/google/zx) | ~4.3.0 | Shell script execution |
| [dayjs](https://day.js.org/) | ~1.11.3 | Date/time formatting |
| [jimp](https://github.com/jimp-dev/jimp) | ~0.16.2 | Image processing |
| [node-fetch](https://github.com/node-fetch/node-fetch) | ~3.3.0 | HTTP requests |
| [file-type](https://github.com/sindresorhus/file-type) | ~18.0.0 | File type detection (dev) |

## Use Cases

1. **Secure File Transfer** - Hide sensitive files inside images to bypass file type restrictions
2. **Privacy Protection** - Add an extra layer of obfuscation beyond standard encryption
3. **Digital Watermarking** - Embed metadata or ownership information in images
4. **Covert Communication** - Transmit hidden data in plain sight

## Building the Steganography Encoder

The steganography encoder is written in C++ and uses CMake to build:

```bash
# Build the steganography binary
make build-steganography

# Or manually
./scripts/build-steganography.sh
```

This will produce the `./steganography` binary used by `conceal_strong.mjs` to embed ZIP files into PNG images.

## Limitations

- Maximum embed size depends on PNG image dimensions
- ZIP password is displayed in console (consider secure handling)
- Requires absolute paths for input directories

## License

MIT

## Acknowledgements

This project uses [steganography](https://github.com/7thSamurai/steganography) as an essential dependency for LSB (Least Significant Bit) image steganography encoding and decoding.

The steganography library provides:

- LSB steganography implementation for PNG images
- AES-256 encryption for embedded data
- SHA-256 password hashing
- Command-line interface for encode/decode operations

Thank you to the maintainers and contributors of the steganography project.
