# FFmpeg Video Conversion

This directory contains Docker-based FFmpeg commands for converting video files.

## Quick Start

Make sure you have Docker installed, then run either command below from this directory.

## Commands Explained

### Option 1: Full Re-encode (Recommended for sharing)

```bash
docker run --rm -v $(pwd):$(pwd) -w $(pwd) --cpus="1.5" --memory="1.5g" jrottenberg/ffmpeg:4.1-alpine \
   -stats \
   -i IMG_9045.MOV \
   -vcodec h264 -acodec aac my-video.mp4
```

- **What it does**: Re-encodes video (H.264) and audio (AAC)
- **Pros**: Smaller file size, better compatibility
- **Cons**: Slower, some quality loss
- **Use case**: When you need smaller files for sharing/streaming

### Option 2: Stream Copy (Fastest)

```bash
docker run --rm -v $(pwd):$(pwd) -w $(pwd) jrottenberg/ffmpeg:4.1-alpine \
   -stats \
   -i IMG_9045.MOV \
   -codec copy my-video2.mp4
```

- **What it does**: Just copies streams without re-encoding
- **Pros**: Instant, no quality loss
- **Cons**: Larger file size, may not improve over original
- **Use case**: Quick format change without re-encoding

## Input/Output

- **Input**: Replace `IMG_9045.MOV` with your source file
- **Output**: The converted file will be created in the current directory

## Notes

- Both commands mount the current directory (`$(pwd)`) into the container
- The first command limits CPU to 1.5 cores and memory to 1.5GB
- Adjust these limits based on your machine's resources
