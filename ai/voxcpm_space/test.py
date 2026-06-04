from voxcpm import VoxCPM
import soundfile as sf

model = VoxCPM.from_pretrained(
    # "openbmb/VoxCPM2", # <- this model is handled by huggingface_hub
                         # it will be downloaded as required
    "./models/VoxCPM-0.5B", # <- use pre-downloaded model to save time
    load_denoiser=False,
    # device="cpu"
)

wav = model.generate(
    text="VoxCPM 2 is the current recommended release for realistic multilingual speech synthesis.",
    cfg_value=2.0,
    inference_timesteps=10,
)
sf.write("demo.wav", wav, model.tts_model.sample_rate)
print("saved: demo.wav")
