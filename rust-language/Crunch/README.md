# Crunch - Rust Version

Crunch is a command line tool that performs lossy optimization of PNG image files using tool [pngquant](https://pngquant.org/) and [zopflipng](https://github.com/chrissimpkins/zopfli).

## Features

- Lossy PNG optimization using pngquant and zopflipng
- Batch processing of multiple files
- Option to replace original files or create new ones with `-crunch` suffix
- Signal handling for graceful shutdown (Ctrl+C)
- Logging capabilities
- PNG file validation

## Installation

### Prerequisites

Before compiling Crunch, you need to have these tools on your system:

See the [`install-dependencies.sh`](https://github.com/AkatQuas/Crunch/blob/main/src/install-dependencies.sh) for detail.

- [pngquant](https://pngquant.org/) and [source code](https://github.com/kornelski/pngquant.git)
- [zopflipng](https://github.com/chrissimpkins/zopfli.git)

### Building from Source

1. Get the code

2. Build the project:

```bash
cargo build --release
```

3. The executable will be available at `target/release/crunch`

## Usage

### Basic Usage

```bash
# Optimize a single file (creates a new file with -crunch suffix)
./crunch image.png

# Optimize multiple files
./crunch image1.png image2.png image3.png

# Replace original files with optimized versions
./crunch --replace image.png

# Output log content
./crunch --log

# Output last 50 lines of log
./crunch --log=50
```

### Options

- `--replace`, `-r`: Replace original file with optimized version
- `--log`, `-l`: Output log content (use `-l N` to specify number of lines, default: 200)
- `--version`, `-v`: Show version information
- `--help`, `-h`: Show help information

## How it Works

1. **File Validation**: All input files are validated to ensure they are valid PNG files
2. **pngquant Stage**: PNG files are processed through pngquant for color reduction and quantization
3. **zopflipng Stage**: The output from pngquant is further compressed using zopflipng
4. **Results**: Optimized files are saved with a `-crunch` suffix or replace the originals if specified

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Based on the original Crunch tool by [Christopher Simpkins](https://github.com/chrissimpkins/Crunch)
- Uses pngquant for color quantization
- Uses zopflipng for additional compression
