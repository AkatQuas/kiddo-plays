# VoxCPM Quick Start

[VoxCPM](https://github.com/OpenBMB/VoxCPM) is a text-to-speech model that generates audio from text input.

> Useful tools
>
> Automatic Speech Recognition: https://github.com/modelscope/FunASR
> Text to Speech: https://github.com/fishaudio/Bert-VITS2
> Text to Speech: https://github.com/fishaudio/fish-speech

## Prerequisites

- Docker installed on your machine

## Setup

### 1. Build the Docker image

```bash
cd voxcpm_space
docker build -t voxcpm ./
```

### 2. Download the model

```bash
# use correct mirror
export HF_ENDPOINT=https://hf-mirror.com

hf download openbmb/VoxCPM-0.5B --local-dir ./models/VoxCPM-0.5B
```

Check [Models released by VoxCPM](https://github.com/OpenBMB/VoxCPM/tree/main#-models--versions).

## Generate Audio

Run the container and execute the test script:

```bash
docker run -it --rm -v ./voxcpm_space:/app voxcpm

python test.py
```

The generated audio will be saved in current directory.

## Custom Usage

To generate audio with your own text, modify `test.py` or create your own script:

```python
from voxcpm import VoxCPM

model = VoxCPM()
audio = model.generate("Hello, this is a test message.")
model.save(audio, "output/my_audio.wav")
```
