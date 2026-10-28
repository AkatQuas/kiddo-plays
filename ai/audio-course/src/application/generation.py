from transformers import pipeline

pipe = pipeline("text-to-audio", model="suno/bark-small")
text = "Ladybugs have had important roles in culture and religion, being associated with luck, love, fertility and prophecy. "
output = pipe(text)

music_pipe = pipeline("text-to-audio", model="facebook/musicgen-small")
text = "90s rock song with electric guitar and heavy drums"
forward_params = {"max_new_tokens": 512}

output = music_pipe(text, forward_params=forward_params)
# from IPython.display import Audio
# Audio(output["audio"][0], rate=output["sampling_rate"])
