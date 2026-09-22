# TTS deployment

Implementation: `services/tts/api.py` (CosyVoice2, OpenAI-compatible HTTP API)

## Start

```bash
cd tts
export INPUT_PATH=./models/CosyVoice2-0_5B
bash infer.sh
```

Default port: **34011**

## Test

```bash
python test_openai_clone.py \
  --text "Hello world" \
  --ref_audio ref.wav \
  --ref_text "reference transcript" \
  --port 34011
```

## Notes

- Requires CosyVoice2 model under `INPUT_PATH`
- Third-party Matcha-TTS path wired in `services/tts/api.py`
- Deploy independently from ASR services
