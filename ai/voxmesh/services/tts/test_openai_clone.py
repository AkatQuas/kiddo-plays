import argparse
import base64
from pathlib import Path

from openai import OpenAI


def wav_to_base64(wav_file_path: str) -> str:
    with open(wav_file_path, 'rb') as audio_file:
        audio_content = audio_file.read()
    base64_audio = base64.b64encode(audio_content).decode('utf-8')
    return base64_audio


def generate_tts_audio(
    text: str,
    ref_audio_path: str,
    ref_text: str,
    output_path: str,
    port: int = 34011,
    model: str = "cosyvoice",
    stream: bool = False,
) -> bool:
    reference_base64 = wav_to_base64(ref_audio_path)
    client = OpenAI(api_key="not-needed", base_url=f"http://localhost:{port}/v1")

    save_path = Path(output_path)
    save_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Sending request to {client.base_url}/audio/speech")
    print(f"Text: {text}")
    print(f"Reference audio: {ref_audio_path}")
    print(f"Reference text: {ref_text}")

    if stream:
        with client.audio.speech.with_streaming_response.create(
            model=model,
            voice="",
            input=text,
            response_format="wav",
            extra_body={
                "references": [
                    {
                        "audio": f"data:audio/wav;base64,{reference_base64}",
                        "text": ref_text
                    }
                ],
                "stream": stream
            }
        ) as response:
            response.stream_to_file(save_path)
    else:
        resp = client.audio.speech.create(
            model=model,
            voice="",
            input=text,
            response_format="wav",
            extra_body={
                "references": [
                    {
                        "audio": f"data:audio/wav;base64,{reference_base64}",
                        "text": ref_text
                    }
                ],
                "stream": stream
            }
        )
        data = getattr(resp, 'content', None)
        if data is None and hasattr(resp, 'read'):
            data = resp.read()
        if data is None:
            raise RuntimeError("OpenAI SDK response has no content/read for non-streaming call")
        with open(save_path, 'wb') as f:
            f.write(data)

    print(f"TTS audio saved to: {save_path}")
    return True


def main():
    parser = argparse.ArgumentParser(description='Test TTS with voice cloning using OpenAI-compatible API')
    parser.add_argument('--text', type=str, required=True, help='Text to synthesize')
    parser.add_argument('--ref_audio', type=str, required=True, help='Reference audio file path (WAV format)')
    parser.add_argument('--ref_text', type=str, required=True, help='Text spoken in reference audio')
    parser.add_argument('--output', type=str, default='output_clone.wav', help='Output WAV file path')
    parser.add_argument('--port', type=int, default=34011, help='TTS server port')
    parser.add_argument('--model', type=str, default='cosyvoice', help='Model name')
    parser.add_argument('--stream', action='store_true', help='Use streaming mode')

    args = parser.parse_args()

    generate_tts_audio(
        text=args.text,
        ref_audio_path=args.ref_audio,
        ref_text=args.ref_text,
        output_path=args.output,
        port=args.port,
        model=args.model,
        stream=args.stream,
    )

if __name__ == '__main__':
    main()
