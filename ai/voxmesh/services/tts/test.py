import argparse
import asyncio
import base64
import wave

import aiohttp


async def test_tts_non_streaming(text: str, output_file: str = "output.wav", host: str = "127.0.0.1", port: int = 34011,
                                 sample_rate: int = 24000, response_format: str = "wav"):
    url = f"http://{host}:{port}/tts"

    payload = {
        "text": text,
        "spk_id": "001",
        "mode": "sft",
        "stream": False,
        "speed": 1.0,
        "sample_rate": sample_rate,
        "response_format": response_format,
    }

    print(f"Sending non-streaming request to {url}")
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            if response.status != 200:
                print(f"Error: HTTP {response.status}")
                print(await response.text())
                return

            data = await response.read()
            # If server returns WAV, just write bytes directly
            with open(output_file, 'wb') as f:
                f.write(data)
    print(f"Audio saved successfully to {output_file}")


async def test_tts_streaming(text: str, output_file: str = "output.wav", host: str = "127.0.0.1", port: int = 34011):
    url = f"http://{host}:{port}/tts/streaming"

    payload = {
        "text": text,
        "spk_id": "001",
        "mode": "sft",
        "stream": True,
        "speed": 1.0,
        "sample_rate": 24000
    }

    print(f"Sending request to {url}")
    print(f"Payload: {payload}")

    audio_chunks = []

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            if response.status != 200:
                print(f"Error: HTTP {response.status}")
                print(await response.text())
                return

            print(f"Response status: {response.status}")
            print("Receiving audio chunks...")

            chunk_count = 0
            async for line in response.content:
                line = line.decode('utf-8').strip()

                if not line:
                    continue

                if line.startswith('event:'):
                    event = line.split(':', 1)[1].strip()
                    continue

                if line.startswith('data:'):
                    data = line.split(':', 1)[1].strip()

                    if event == 'audio':
                        audio_bytes = base64.b64decode(data)
                        audio_chunks.append(audio_bytes)
                        chunk_count += 1
                        print(f"Received chunk {chunk_count}, size: {len(audio_bytes)} bytes")

                    elif event == 'done':
                        print("Stream completed")
                        break

                    elif event == 'error':
                        print(f"Error from server: {data}")
                        return

    if audio_chunks:
        print(f"\nTotal chunks received: {len(audio_chunks)}")
        print(f"Saving audio to {output_file}")

        with wave.open(output_file, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(payload['sample_rate'])
            wf.writeframes(b''.join(audio_chunks))

        print(f"Audio saved successfully to {output_file}")
    else:
        print("No audio data received")


def main():
    parser = argparse.ArgumentParser(description='Test TTS API')
    parser.add_argument('--text', type=str, default='你好，这是一个语音合成测试。', help='Text to synthesize')
    parser.add_argument('--output', type=str, default='output.wav', help='Output audio file path')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='TTS server host')
    parser.add_argument('--port', type=int, default=34011, help='TTS server port')
    parser.add_argument('--stream', action='store_true', help='Use streaming mode')
    parser.add_argument('--format', type=str, default='wav', choices=['wav', 'pcm'], help='Non-streaming response format')
    parser.add_argument('--sample_rate', type=int, default=24000, help='Sample rate for output')

    args = parser.parse_args()
    if args.stream:
        asyncio.run(test_tts_streaming(args.text, args.output, args.host, args.port))
    else:
        asyncio.run(test_tts_non_streaming(args.text, args.output, args.host, args.port, args.sample_rate, args.format))


if __name__ == '__main__':
    main()
