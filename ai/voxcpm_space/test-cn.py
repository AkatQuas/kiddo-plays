from voxcpm import VoxCPM
import soundfile as sf

model = VoxCPM.from_pretrained(
    "./models/VoxCPM-0.5B",
    load_denoiser=False,
    # device="cpu"
)

wav = model.generate(
    text="VoxCPM 2 是一个很牛逼的语音生成模型，因为他不要花钱！",
    cfg_value=2.0,
    inference_timesteps=10,
)
sf.write("demo-cn.wav", wav, model.tts_model.sample_rate)
print("saved: demo-cn.wav")
