import numpy as np
import torch
from datasets import load_dataset
from IPython.display import Audio
from transformers import pipeline

dataset = load_dataset(
    "hf-internal-testing/librispeech_asr_dummy", "clean", split="validation"
)

# print(dataset)
sample = dataset[2]

print(sample["text"])
Audio(sample["audio"]["array"], rate=sample["audio"]["sampling_rate"])


# ctc recognition
pipe = pipeline("automatic-speech-recognition", model="facebook/wav2vec2-base-100h")
pipe(sample["audio"].copy())


# Seq2Seq
device = "cuda:0" if torch.cuda.is_available() else "cpu"
pipe = pipeline(
    "automatic-speech-recognition", model="openai/whisper-base", device=device
)

pipe(sample["audio"], max_new_tokens=256)

dataset = load_dataset(
    "facebook/multilingual_librispeech", "spanish", split="validation", streaming=True
)
sample = next(iter(dataset))
print(sample["text"])
Audio(sample["audio"]["array"], rate=sample["audio"]["sampling_rate"])

pipe(sample["audio"].copy(), max_new_tokens=256, generate_kwargs={"task": "transcribe"})

pipe(sample["audio"], max_new_tokens=256, generate_kwargs={"task": "translate"})

target_length_in_m = 5

# convert from minutes to seconds (* 60) to num samples (* sampling rate)
sampling_rate = pipe.feature_extractor.sampling_rate
target_length_in_samples = target_length_in_m * 60 * sampling_rate

# iterate over our streaming dataset, concatenating samples until we hit our target
long_audio = []
for sample in dataset:
    long_audio.extend(sample["audio"]["array"])
    if len(long_audio) > target_length_in_samples:
        break

long_audio = np.asarray(long_audio)

# how did we do?
seconds = len(long_audio) / 16000
minutes, seconds = divmod(seconds, 60)
print(f"Length of audio sample is {minutes} minutes {seconds:.2f} seconds")

pipe(
    long_audio,
    max_new_tokens=256,
    generate_kwargs={"task": "transcribe"},
    chunk_length_s=30,
    batch_size=8,
)
