
import numpy as np
import torch
from pyannote.audio import Model


class SpeechDetector:

    def __init__(
        self,
        model_path,
        framerate,
        threshold,
        silence_duration_s,
        max_speech_duration_s,
        speech_start_buffer,
        device="cuda",
        cache_duration_s=1.0,
        min_duration_on=0.136,
    ):
        self.framerate = framerate
        self.threshold = threshold
        self.silence_duration_s = silence_duration_s
        self.max_speech_duration_s = max_speech_duration_s
        self.cache_duration_s = cache_duration_s

        self.model = Model.from_pretrained(model_path, device=device)

        # 音频缓存相关
        self.cache_samples = int(self.cache_duration_s * self.framerate)
        self.audio_cache = np.array([], dtype=np.int16)

        self.audio_buffer = None
        self.silence_last_s = 0
        self.is_speech = False
        self.samples_count = 0
        self.last_speech_pos = 0

        # 添加最小语音持续时间参数
        self.min_duration_on = min_duration_on
        self.min_samples_on = int(min_duration_on * self.framerate)

        # 缓存潜在语音帧
        self.potential_speech_cache = []
        self.potential_speech_samples = 0

        # 静音检测相关，预计算样本数
        self.silence_samples_threshold = int(self.silence_duration_s * self.framerate)
        self.silence_samples_count = 0
        self.original_silence_duration_s = silence_duration_s

    def get_dynamic_silence_duration(self):
        """根据当前语音持续时长动态调整静音检测阈值"""
        if not self.is_speech:
            return self.original_silence_duration_s

        current_speech_samples = self.samples_count - self.last_speech_pos
        max_speech_samples = self.max_speech_duration_s * self.framerate
        speech_progress = current_speech_samples / max_speech_samples

        if speech_progress >= 2/3:
            # 说话时长超过2/3时，静音阈值降低到1/3
            return self.original_silence_duration_s / 3
        # elif speech_progress >= 1/2:
        #     # 说话时长超过1/2时，静音阈值降低到1/2
        #     return self.original_silence_duration_s / 2
        else:
            return self.original_silence_duration_s

    def reset(self):
        self.audio_buffer = None
        self.silence_last_s = 0
        self.is_speech = False
        self.samples_count = 0
        self.last_speech_pos = 0
        self.audio_cache = np.array([], dtype=np.int16)
        self.potential_speech_cache = []
        self.potential_speech_samples = 0
        self.silence_samples_count = 0

    def detect(self, audio):
        # 将新音频添加到缓存
        self.audio_cache = np.concatenate([self.audio_cache, audio])

        # 如果缓存未满，返回空
        if len(self.audio_cache) < self.cache_samples:
            return

        available_audio = self.audio_cache[:self.cache_samples]
        self.audio_cache = self.audio_cache[self.cache_samples:]

        # 将音频数据转换为waveform格式用于pyannote
        waveform = torch.from_numpy(available_audio).unsqueeze(0)

        vad_output = self.model(waveform)
        # logger.info(f"vad_output: {vad_output}")
        vad_output = torch.max(vad_output, dim=2, keepdim=True)[0]

        frame_count = vad_output.shape[1]
        neg_threshold = max(self.threshold - 0.15, 0.01)

        samples_per_frame = int(waveform.shape[1] / frame_count)

        for i in range(frame_count):
            speech_prob = vad_output[0, i, 0].item()
            start_idx = int(i * samples_per_frame)
            end_idx = int((i + 1) * samples_per_frame) if i < frame_count - 1 else waveform.shape[1]
            frame_buffer = available_audio[start_idx:end_idx]

            speech_threshold = neg_threshold if self.is_speech else self.threshold
            if speech_prob > speech_threshold:
                self.silence_last_s = 0
                self.silence_samples_count = 0
                if not self.is_speech:
                    # 缓存潜在的语音帧
                    self.potential_speech_cache.append(frame_buffer)
                    self.potential_speech_samples += samples_per_frame

                    # 检查缓存的样本数是否达到最小要求
                    if self.potential_speech_samples >= self.min_samples_on:
                        self.is_speech = True
                        self.last_speech_pos = self.samples_count

                        # 输出缓存的潜在语音帧
                        for cached_frame in self.potential_speech_cache:
                            yield cached_frame, True

                        # 清空缓存
                        self.potential_speech_cache = []
                        self.potential_speech_samples = 0
                    else:
                        # 还未达到最小持续时间，不输出
                        self.samples_count += samples_per_frame
                        continue
                else:
                    speech_samples = self.samples_count - self.last_speech_pos
                    if speech_samples > self.max_speech_duration_s * self.framerate:
                        self.is_speech = False
            else:
                if not self.is_speech:
                    # 清空潜在语音缓存，因为遇到了非语音帧
                    self.potential_speech_cache = []
                    self.potential_speech_samples = 0
                else:
                    # is_speech=True时的静音处理
                    self.silence_samples_count += samples_per_frame
                    # 使用动态静音阈值
                    dynamic_silence_duration = self.get_dynamic_silence_duration()
                    dynamic_silence_threshold = int(dynamic_silence_duration * self.framerate)
                    if self.silence_samples_count >= dynamic_silence_threshold:
                        self.is_speech = False

            # 只有在is_speech=True或者不在缓存状态时才输出frame
            if self.is_speech or len(self.potential_speech_cache) == 0:
                yield frame_buffer, self.is_speech

            self.samples_count += samples_per_frame
