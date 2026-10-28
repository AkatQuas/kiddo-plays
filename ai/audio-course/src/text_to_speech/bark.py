from IPython.display import Audio
from transformers import BarkModel, BarkProcessor

# processor 管“翻译”：在人类可读的文本/音色和模型能吃的张量之间做转换。它不生成任何内容。
processor = BarkProcessor.from_pretrained("suno/bark-small")

# model 管“生成”：真正做自回归预测，产出音频 token。它不关心原始文本长什么样，只吃 processor 给它的张量。
model = BarkModel.from_pretrained("suno/bark-small")

sampling_rate = model.generation_config.sample_rate
# add a speaker embedding
inputs = processor("This is a test!", voice_preset="v2/en_speaker_3")

speech_output = model.generate(**inputs).cpu().numpy()
Audio(speech_output, rate=sampling_rate)

# try it in French, let's also add a French speaker embedding
inputs = processor("C'est un test!", voice_preset="v2/fr_speaker_1")

speech_output = model.generate(**inputs).cpu().numpy()
Audio(speech_output, rate=sampling_rate)

inputs = processor(
    "[clears throat] This is a test ... and I just took a long pause.",
    voice_preset="v2/fr_speaker_1",
)

speech_output = model.generate(**inputs).cpu().numpy()
Audio(speech_output, rate=sampling_rate)

inputs = processor(
    "♪ In the mighty jungle, I'm trying to generate barks.",
)

speech_output = model.generate(**inputs).cpu().numpy()
Audio(speech_output, rate=sampling_rate)

###

input_list = [
    "[clears throat] Hello uh ..., my dog is cute [laughter]",
    "Let's try generating speech, with Bark, a text-to-speech model",
    "♪ In the jungle, the mighty jungle, the lion barks tonight ♪",
]

# also add a speaker embedding
inputs = processor(input_list, voice_preset="v2/en_speaker_3")

speech_output = model.generate(**inputs).cpu().numpy()
Audio(speech_output[0], rate=sampling_rate)
Audio(speech_output[1], rate=sampling_rate)
Audio(speech_output[2], rate=sampling_rate)
