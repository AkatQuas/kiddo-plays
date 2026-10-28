import librosa
import matplotlib.pyplot as plt
import numpy as np
from datasets import load_dataset
from transformers import WhisperFeatureExtractor

minds = load_dataset("PolyAI/minds14", name="en-AU", split="train")
MAX_DURATION_IN_SECONDS = 10.0


def is_audio_length_in_range(input_length):
    return input_length < MAX_DURATION_IN_SECONDS

# use librosa to get example's duration from the audio file
new_column = [
    librosa.get_duration(y=x["array"], sr=x["sampling_rate"]) for x in minds["audio"]
]
minds = minds.add_column("duration", new_column)

# use 🤗 Datasets' `filter` method to apply the filtering function
minds = minds.filter(is_audio_length_in_range, input_columns=["duration"])

# remove the temporary helper column
minds = minds.remove_columns(["duration"])
print(minds)

# upsample all audio
# minds = minds.cast_column("audio", Audio(sampling_rate=16_000))
# print(minds)

feature_extractor = WhisperFeatureExtractor.from_pretrained("openai/whisper-small")

def prepare_dataset(example):
    audio = example["audio"]

    if audio["sampling_rate"] != 16000:
        audio_array = librosa.resample(
            audio["array"], orig_sr=audio["sampling_rate"], target_sr=16000
        )
        audio = {"array": audio_array, "sampling_rate": 16000}

    features = feature_extractor(
        audio["array"], sampling_rate=audio["sampling_rate"], padding=True
    )
    return features

minds = minds.map(prepare_dataset)
print(minds)

example = minds[0]
input_features = example["input_features"]

plt.figure().set_figwidth(12)
librosa.display.specshow(
    np.asarray(input_features[0]),
    x_axis="time",
    y_axis="mel",
    sr=feature_extractor.sampling_rate,
    hop_length=feature_extractor.hop_length,
)
plt.colorbar()
plt.show()


from transformers import AutoProcessor

processor = AutoProcessor.from_pretrained("openai/whisper-small")
