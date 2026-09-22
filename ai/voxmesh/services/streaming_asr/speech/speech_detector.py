from collections import deque

import numpy as np
import speech.vad as vad
from common.logger_config import logger


class SpeechDetector:

    def __init__(
        self,
        model_path,
        framerate,
        threshold,
        silence_duration_s,
        max_speech_duration_s,
        speech_start_buffer,
    ):
        self.framerate = framerate
        self.threshold = threshold
        self.silence_duration_s = silence_duration_s
        self.max_speech_duration_s = max_speech_duration_s

        self.model = vad.get_vad_model(model_path)
        self.state = self.model.get_initial_state(batch_size=1)
        self.audio_buffer = None
        self.silence_last_s = 0
        self.is_speech = False
        self.samples_count = 0
        self.last_speech_pos = 0

        # 添加语音开始缓冲机制
        self.speech_start_buffer = speech_start_buffer  # 语音开始前保留多少秒的音频数据
        self.speech_start_samples = int(self.speech_start_buffer * self.framerate)

        self.buffer_chunks = int(
            np.ceil(self.speech_start_samples / 512)
        )  # 计算需要的块数,512是模型输入的帧大小
        self.pre_speech_buffer = deque(maxlen=self.buffer_chunks)

    def reset(self):
        self.audio_buffer = None
        self.silence_last_s = 0
        self.is_speech = False
        self.samples_count = 0
        self.last_speech_pos = 0
        self.pre_speech_buffer = deque(maxlen=self.buffer_chunks)
        self.state = self.model.get_initial_state(batch_size=1)

    def detect(self, audio):
        samples = 512 if self.framerate == 16000 else 256
        det_interval_s = float(samples) / self.framerate
        if self.audio_buffer is None:
            self.audio_buffer = audio
        else:
            self.audio_buffer = np.concatenate((self.audio_buffer, audio))

        neg_threshold = max(self.threshold - 0.15, 0.01)
        while len(self.audio_buffer) >= samples:
            audio = self.audio_buffer[:samples]
            # 确保音频数据在正确范围内
            audio_normalized = np.clip(audio / 32768.0, -1.0, 1.0)
            speech_prob, self.state = self.model(
                audio_normalized, self.state, self.framerate
            )
            logger.debug(f"detect: speech_prob={speech_prob}, is_speech={self.is_speech}")
            speech_threshold = neg_threshold if self.is_speech else self.threshold
            if speech_prob > speech_threshold:
                self.silence_last_s = 0
                if not self.is_speech:
                    self.is_speech = True
                    self.last_speech_pos = self.samples_count
                    # 语音开始时，包含预语音缓冲区
                    if len(self.pre_speech_buffer) > 0:
                        pre_speech_audio = np.concatenate(self.pre_speech_buffer)
                        self.pre_speech_buffer.clear()
                        yield pre_speech_audio, self.is_speech
                else:
                    speech_frames = self.samples_count - self.last_speech_pos
                    if speech_frames / self.framerate > self.max_speech_duration_s:
                        self.is_speech = False
            else:
                if self.is_speech:
                    self.silence_last_s += det_interval_s
                    if self.silence_last_s >= self.silence_duration_s:
                        self.is_speech = False
                else:
                    # 非语音状态下，需要保留预语音缓冲区
                    self.pre_speech_buffer.append(audio)

            yield audio, self.is_speech

            self.samples_count += samples
            self.audio_buffer = self.audio_buffer[samples:]
