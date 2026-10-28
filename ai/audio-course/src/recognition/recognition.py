from datasets import Audio, load_dataset
from transformers import pipeline

# English
minds = load_dataset("PolyAI/minds14", name="en-AU", split="train")
minds = minds.cast_column("audio", Audio(sampling_rate=16_000))

# using default model "facebook/wav2vec2-base-960h"
asr = pipeline("automatic-speech-recognition")

example = minds[0]

asr(example["audio"]["array"])

example["english_transcription"]


# German
minds = load_dataset("PolyAI/minds14", name="de-DE", split="train")
minds = minds.cast_column("audio", Audio(sampling_rate=16_000))
example = minds[0]
example["transcription"]

asr = pipeline("automatic-speech-recognition", model="maxidl/wav2vec2-large-xlsr-german")
asr(example["audio"]["array"])
