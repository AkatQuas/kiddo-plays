import gradio as gr
from transformers import pipeline

model_id = "sanchit-gandhi/distilhubert-finetuned-gtzan"
pipe = pipeline("audio-classification", model=model_id)

def classify_audio(filepath):
    preds = pipe(filepath)
    outputs = {}
    for p in preds:
        outputs[p["label"]] = p["score"]
    return outputs

demo = gr.Interface(
    fn=classify_audio, inputs=gr.Audio(type="filepath"), outputs=gr.outputs.Label()
)
demo.launch(debug=True)
