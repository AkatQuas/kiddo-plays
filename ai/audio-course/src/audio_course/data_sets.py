import gradio as gr
import librosa
import librosa.display
import matplotlib.pyplot as plt
from datasets import load_dataset

minds = load_dataset("PolyAI/minds14", name="en-AU", split="train")
print(minds)

example = minds[0]
print(example)

id2label = minds.features["intent_class"].int2str

def random_audio():
    example = minds.shuffle()[0]
    audio = example["audio"]
    return (
        audio["sampling_rate"],
        audio["array"],
    ), id2label(example["intent_class"])


with gr.Blocks() as demo, gr.Column():
    for _ in range(4):
        audio, label = random_audio()
        output = gr.Audio(audio, label=label)

# uncomment to start a gradio server
# demo.launch(debug=True)

array = example["audio"]["array"]
sampling_rate = example["audio"]["sampling_rate"]

plt.figure().set_figwidth(12)
librosa.display.waveshow(array, sr=sampling_rate)
# uncomment to display plot figure
# plt.show()
