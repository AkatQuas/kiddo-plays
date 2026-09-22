#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基于模型池的实时语音识别器
从模型池获取预创建的模型实例，提高连接建立速度
"""

import queue
import threading
import time
from typing import Callable, Optional

import numpy as np
from advice.streaming_advice import StreamingAdvice
from common.logger_config import logger
from common.volume_detector import VolumeDetector
from model.model_pool import PooledASRModel, PooledDetector, PooledSpeakerClustering, model_pool_manager
from service.audio_gain_controller import AudioGainController
from service.text_corrector import get_text_corrector


class PooledRealtimeSpeechRecognizer:
    """基于模型池的实时语音识别器"""

    def __init__(
        self,
        embedding_model_dir: str = "speechbrain/spkrec-ecapa-voxceleb",
        spk_delta_new: float = 0.72,
        spk_max_speakers: int = 20,
        sample_rate: int = 16000,
        transcribe_interval: float = 1.0,
        is_debug: bool = False,
        result_callback: Optional[Callable] = None,
        enable_async: bool = True,
        enable_advice: bool = False,
        advice_callback: Optional[Callable] = None,
        enable_text_correction: bool = False,
        text_correction_min_length: int = 40,
        hotword: list = None,
        device: str = "cuda",
        enable_volume_detection: bool = True,
        volume_threshold_db: float = -35.0,
        volume_check_duration_s: float = 1.0,
        volume_warning_interval_s: float = 2.0,
        volume_callback: Optional[Callable] = None,
        enable_auto_gain: bool = False,
        speakers: list = None,
        **kwargs
    ):

        # 从池中借用的模型实例
        self.pooled_detector: Optional[PooledDetector] = None
        self.pooled_asr_model: Optional[PooledASRModel] = None
        self.pooled_speaker_clustering: Optional[PooledSpeakerClustering] = None

        # 参数配置
        self.sample_rate = sample_rate
        self.transcribe_interval = transcribe_interval
        self.is_debug = is_debug
        self.result_callback = result_callback
        self.enable_async = enable_async
        self.enable_advice = enable_advice
        self.advice_callback = advice_callback
        self.enable_text_correction = enable_text_correction
        self.text_correction_min_length = text_correction_min_length
        self.hotword = hotword if hotword else []


        # 音频增益控制器（仅在启用时创建）
        self.audio_gain_controller = None
        self.enable_auto_gain = enable_auto_gain
        if enable_auto_gain:
            self.audio_gain_controller = AudioGainController(
                sample_rate=sample_rate,
                window_duration=1.0,
                target_db=-10.0
            )

        # 状态管理
        self.sentence_id = 0
        self.speech_state = False
        self.sample_count = 0
        self.next_transcribe_time = 0.0
        self.audio_buffer = np.empty(0, dtype=np.int16)
        self.begin_ts = 0.0  # 记录每句话开始的时间戳
        self.connection_start_time = time.time()  # 连接建立的初始时间
        self.client_time = 0.0 # 客户端重新连接的时间

        # 异步处理相关
        self.audio_frame_queue = queue.Queue() if enable_async else None
        self.worker_thread = None
        self.stop_worker = False

        # 说话人识别参数（将用于从池中获取）
        self.embedding_model_dir = embedding_model_dir
        self.spk_delta_new = spk_delta_new
        self.spk_max_speakers = spk_max_speakers
        self.device = device
        self.speakers = speakers

        # VAD相关参数（从kwargs中提取，用于连接级配置）
        self.vad_threshold = kwargs.get('vad_threshold', None)
        self.vad_silence_duration_s = kwargs.get('vad_silence_duration_s', None)
        self.vad_max_speech_duration_s = kwargs.get('vad_max_speech_duration_s', None)
        self.vad_speech_start_buffer = kwargs.get('vad_speech_start_buffer', None)

        # AI建议相关
        self.streaming_advice = None
        if enable_advice and advice_callback:
            self.streaming_advice = StreamingAdvice(advice_callback)
            logger.info("AI建议功能已启用")

        # 音量检测相关
        self.enable_volume_detection = enable_volume_detection
        self.volume_callback = volume_callback
        self.volume_detector = None
        if enable_volume_detection:
            self.volume_detector = VolumeDetector(
                sample_rate=sample_rate,
                volume_threshold_db=volume_threshold_db,
                check_duration_s=volume_check_duration_s,
                warning_interval_s=volume_warning_interval_s,
                warning_callback=volume_callback
            )

        logger.info(f"池化语音识别器初始化完成，连接参数: spk_delta_new={self.spk_delta_new}, "
                f"spk_max_speakers={self.spk_max_speakers}, transcribe_interval={self.transcribe_interval}, "
                f"enable_text_correction={self.enable_text_correction}, text_correction_min_length={self.text_correction_min_length}, "
                f"hotword_count={len(self.hotword)}")

    def save_speaker_clustering(self) -> Optional[dict]:
        """保存ASR实例的会话状态"""
        from pipeline.speaker_state import save_speaker_clustering

        return save_speaker_clustering(self.pooled_speaker_clustering)

    def restore_speaker_clustering(self, speaker_data: dict) -> bool:
        """恢复ASR实例的会话状态"""
        from pipeline.speaker_state import restore_speaker_clustering

        return restore_speaker_clustering(self.pooled_speaker_clustering, speaker_data)

    def acquire_models(self, timeout: float = 10.0) -> bool:
        """从池中获取模型实例"""
        try:
            logger.info("从模型池获取模型实例...")

            # 获取Detector
            self.pooled_detector = model_pool_manager.get_detector(timeout=timeout)
            if not self.pooled_detector:
                logger.error("无法从池中获取Detector模型")
                return False

            # 获取ASR模型（从配置的ASR池中获取）
            self.pooled_asr_model = model_pool_manager.get_configured_asr_model(timeout=timeout)
            if not self.pooled_asr_model:
                logger.error("无法从池中获取ASR模型")
                # 归还已获取的Detector
                if self.pooled_detector:
                    model_pool_manager.return_detector(self.pooled_detector)
                    self.pooled_detector = None
                return False

            # 获取说话人识别模型（应该和detector池大小相同，必须成功）
            self.pooled_speaker_clustering = model_pool_manager.get_speaker_clustering(timeout=timeout)
            if not self.pooled_speaker_clustering:
                logger.error("无法从池中获取说话人识别模型")
                # 归还已获取的模型
                if self.pooled_detector:
                    model_pool_manager.return_detector(self.pooled_detector)
                    self.pooled_detector = None
                if self.pooled_asr_model:
                    model_pool_manager.return_asr_model(self.pooled_asr_model)
                    self.pooled_asr_model = None
                return False

            logger.info("模型实例获取成功")

            # 应用连接级参数配置
            self._apply_connection_params()

            # 如果启用异步处理，启动工作线程
            if self.enable_async and self.result_callback:
                self._start_worker_thread()

            return True

        except Exception as e:
            logger.error(f"获取模型实例失败: {e}")
            self.release_models()
            return False

    def _apply_connection_params(self):
        """应用连接级参数配置"""
        try:
            logger.info(f"应用连接级参数配置: spk_delta_new={self.spk_delta_new}, "
                    f"spk_max_speakers={self.spk_max_speakers}, transcribe_interval={self.transcribe_interval}")

            # 更新说话人识别参数
            if self.pooled_speaker_clustering:
                speaker_clustering = self.pooled_speaker_clustering.speaker_clustering

                # 更新说话人识别参数
                if hasattr(speaker_clustering, 'delta_new'):
                    old_value = getattr(speaker_clustering, 'delta_new', 'unknown')
                    speaker_clustering.delta_new = self.spk_delta_new
                    logger.info(f"更新说话人识别阈值: {old_value} -> {self.spk_delta_new}")

                if hasattr(speaker_clustering, 'max_speakers'):
                    old_value = getattr(speaker_clustering, 'max_speakers', 'unknown')
                    speaker_clustering.max_speakers = self.spk_max_speakers
                    logger.info(f"更新最大说话人数: {old_value} -> {self.spk_max_speakers}")

                # 注册预定义的说话人
                if self.speakers and hasattr(speaker_clustering, 'register_speakers'):
                    logger.info(f"注册 {len(self.speakers)} 个预定义说话人到聚类器")
                    speaker_clustering.register_speakers(self.speakers)

            # 更新Detector参数
            if self.pooled_detector:
                detector = self.pooled_detector.detector

                # 更新VAD参数
                if self.vad_threshold is not None and hasattr(detector, 'threshold'):
                    old_value = getattr(detector, 'threshold', 'unknown')
                    detector.threshold = self.vad_threshold
                    logger.info(f"更新VAD阈值: {old_value} -> {self.vad_threshold}")

                if self.vad_silence_duration_s is not None and hasattr(detector, 'silence_duration_s'):
                    old_value = getattr(detector, 'silence_duration_s', 'unknown')
                    detector.silence_duration_s = self.vad_silence_duration_s
                    logger.info(f"更新VAD静音时长: {old_value} -> {self.vad_silence_duration_s}")

                if self.vad_max_speech_duration_s is not None and hasattr(detector, 'max_speech_duration_s'):
                    old_value = getattr(detector, 'max_speech_duration_s', 'unknown')
                    detector.max_speech_duration_s = self.vad_max_speech_duration_s
                    logger.info(f"更新VAD最大语音时长: {old_value} -> {self.vad_max_speech_duration_s}")

                if self.vad_speech_start_buffer is not None and hasattr(detector, 'speech_start_buffer'):
                    old_value = getattr(detector, 'speech_start_buffer', 'unknown')
                    detector.speech_start_buffer = self.vad_speech_start_buffer
                    logger.info(f"更新VAD语音开始缓冲: {old_value} -> {self.vad_speech_start_buffer}")

            logger.info("连接级参数配置完成")

        except Exception as e:
            logger.error(f"应用连接级参数配置失败: {e}")
            import traceback
            traceback.print_exc()


    def release_models(self):
        """释放模型实例回池中"""
        logger.info("释放模型实例回池")

        # 停止异步处理线程
        thread_stopped = False
        try:
            if self.worker_thread and self.worker_thread.is_alive():
                self.stop_worker = True
                self.worker_thread.join(timeout=2.0)
                thread_stopped = True
                logger.info("工作线程已正常停止")
        except Exception as e:
            logger.warning(f"停止工作线程失败: {e}，但继续归还模型")

        # 确保模型实例始终被归还，即使线程停止失败
        models_returned = 0
        total_models = 0

        # 归还ASR模型
        if self.pooled_asr_model:
            total_models += 1
            try:
                model_pool_manager.return_asr_model(self.pooled_asr_model)
                self.pooled_asr_model = None
                models_returned += 1
                logger.info("ASR模型已归还")
            except Exception as e:
                logger.error(f"归还ASR模型失败: {e}")

        # 归还说话人识别模型
        if self.pooled_speaker_clustering:
            total_models += 1
            try:
                model_pool_manager.return_speaker_clustering(self.pooled_speaker_clustering)
                self.pooled_speaker_clustering = None
                models_returned += 1
                logger.info("说话人识别模型已归还")
            except Exception as e:
                logger.error(f"归还说话人识别模型失败: {e}")

        # 归还Detector
        if self.pooled_detector:
            total_models += 1
            try:
                model_pool_manager.return_detector(self.pooled_detector)
                self.pooled_detector = None
                models_returned += 1
                logger.info("Detector模型已归还")
            except Exception as e:
                logger.error(f"归还Detector模型失败: {e}")

        # 清理AI建议资源
        try:
            if self.streaming_advice:
                self.streaming_advice.cleanup()
                self.streaming_advice = None
                logger.info("AI建议资源已清理")
        except Exception as e:
            logger.error(f"清理AI建议资源失败: {e}")

        # 清理音量检测器资源
        try:
            if self.volume_detector:
                self.volume_detector.reset_buffer()
                self.volume_detector = None
        except Exception as e:
            logger.error(f"清理音量检测器资源失败: {e}")

        logger.info(f"模型实例释放完成: 归还 {models_returned}/{total_models} 个模型, 线程停止: {thread_stopped}")

    def _start_worker_thread(self):
        """启动工作线程"""
        self.stop_worker = False
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        logger.info("异步识别工作线程已启动")

    def _worker_loop(self):
        """工作线程循环处理音频帧"""
        while not self.stop_worker:
            try:
                audio_bytes = self.audio_frame_queue.get(timeout=0.1)
                results = self._process_audio_frame(audio_bytes)

                if results and self.result_callback:
                    self.result_callback(results)

                self.audio_frame_queue.task_done()

            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"工作线程处理音频帧时出错: {e}")
                import traceback
                traceback.print_exc()

    def gen_result(self, t, text=None, latency=0.0, current_speaker="", speaker_distance=None, begin_ts=None):
        """生成识别结果"""
        result = {
            "type": t,
            "id": self.sentence_id,
            "text": text,
            "ts": time.time() - self.connection_start_time,
            "latency": latency,
            "current_speaker": str(current_speaker),
        }
        if speaker_distance is not None:
            result["speaker_distance"] = speaker_distance
        if begin_ts is not None:
            result["b_ts"] = begin_ts
        return result

    def transcribe(self):
        """流式转录"""
        if not self.pooled_asr_model:
            logger.error("ASR模型未获取")
            return "", 0.0

        start_time = time.time()
        text = self.pooled_asr_model.get_streaming_model().transcribe()
        return text, time.time() - start_time

    def transcribe_with_timestamp(self):
        """流式转录，包含时间戳"""
        if not self.pooled_asr_model:
            logger.error("ASR模型未获取")
            return "", [], []

        result = self.pooled_asr_model.get_streaming_model().transcribe_with_timestamp()

        # 安全地获取字段，如果不存在则使用默认值
        text = result.get("text", "")
        timestamp = result.get("timestamp", [])
        words = result.get("words", [])

        logger.debug(f"transcribe_with_timestamp: text='{text}', timestamp长度={len(timestamp)}, words长度={len(words)}")

        return text, timestamp, words

    def transcribe_offline(self):
        """离线转录，带发言人识别和句子分段"""
        start_time = time.time()

        if not self.pooled_asr_model:
            logger.error("ASR模型未获取")
            return [], time.time() - start_time

        # 离线转录和在线转录使用相同的模型
        assert self.pooled_asr_model.same_type, "离线转录仅支持相同类型的模型"

        text, timestamp, words = self.transcribe_with_timestamp()

        if text.strip() == '.' or text.strip() == '。':
            return [], time.time() - start_time

        logger.info(f"离线转录结果: {text}")

        # 根据标点符号拆分句子进行发言人识别
        if not words or not timestamp:
            # 如果没有时间戳和words信息，使用兜底方案：直接用原音频做发言人识别
            logger.info("没有时间戳和words信息，使用兜底方案进行发言人识别")
            results = self._fallback_speaker_identification(text)
        else:
            results = self._process_sentences_with_speaker_identification(text, timestamp, words)

        # 对每个结果进行文本纠错
        if self.enable_text_correction:
            try:
                corrector = get_text_corrector()
                if corrector.is_available():
                    for result in results:
                        if result['text']:
                            # 传递热词给文本纠错器
                            corrected_text = corrector.correct_text(result['text'], hotwords=self.hotword)
                            if corrected_text != result['text']:
                                logger.debug(f"文本纠错 (热词:{len(self.hotword)}个): '{result['text']}' -> '{corrected_text}'")
                                result['text'] = corrected_text
                            else:
                                logger.debug(f"文本无需纠错 (热词:{len(self.hotword)}个): '{result['text']}'")
                else:
                    logger.warning("文本纠错器不可用，跳过纠错")
            except Exception as e:
                logger.error(f"离线转录文本纠错失败: {e}")
        else:
            logger.debug("文本纠错功能未启用")

        return results, time.time() - start_time

    def _process_sentences_with_speaker_identification(self, text, timestamp, words):
        """根据标点符号拆分句子并进行发言人识别"""
        if not words or not timestamp:
            return []

        # 标点符号列表（中英文）
        punctuations = ['。', '！', '？', '，', '；', '：', '.', '!', '?', ',', ';', ':']

        # 拆分句子
        sentences = []
        current_sentence = []
        current_timestamps = []

        for i, word in enumerate(words):
            current_sentence.append(word)
            if i < len(timestamp):
                current_timestamps.append(timestamp[i])

            # 如果遇到标点符号，结束当前句子
            if word in punctuations:
                sentence_text = ''.join(current_sentence)
                # 过滤掉只有单独标点符号的句子
                if len(current_sentence) > 1 or (len(current_sentence) == 1 and current_sentence[0] not in punctuations):
                    sentences.append({
                        'text': sentence_text,
                        'words': current_sentence.copy(),
                        'timestamps': current_timestamps.copy()
                    })
                current_sentence = []
                current_timestamps = []

        # 处理最后一个句子（如果没有以标点符号结尾）
        if current_sentence:
            sentence_text = ''.join(current_sentence)
            # 过滤掉只有单独标点符号的句子
            if len(current_sentence) > 1 or (len(current_sentence) == 1 and current_sentence[0] not in punctuations):
                sentences.append({
                    'text': sentence_text,
                    'words': current_sentence.copy(),
                    'timestamps': current_timestamps.copy()
                })

        if not sentences:
            return []

        # 合并时长不足1秒的短段落
        sentences = self._merge_short_segments(sentences)

        # 为每个句子进行发言人识别
        sentence_speakers = []
        for sentence in sentences:
            # 获取句子的音频片段时间范围
            start_time_ms = sentence['timestamps'][0][0]
            end_time_ms = sentence['timestamps'][-1][1]

            # 计算句子时长（毫秒转秒）
            duration_s = (end_time_ms - start_time_ms) / 1000.0

            # 计算音频片段在缓冲区中的位置
            start_sample = int(start_time_ms * self.sample_rate / 1000)
            end_sample = int(end_time_ms * self.sample_rate / 1000)

            # 提取对应的音频片段
            wav_buffer = self.pooled_asr_model.get_streaming_model().get_wav_buffer()
            end_sample = min(end_sample, len(wav_buffer))
            audio_segment = wav_buffer[start_sample:end_sample]

            # 发言人识别
            speaker_id, speaker_distance = self.pooled_speaker_clustering.speaker_clustering.cluster(audio_segment)

            sentence_speakers.append({
                'text': sentence['text'],
                'speaker_id': speaker_id,
                'speaker_distance': speaker_distance,
                'start_time_ms': start_time_ms,
                'end_time_ms': end_time_ms,
                'duration_s': duration_s
            })

            logger.info(f"句子: '{sentence['text']}' -> 发言人: {speaker_id}")

        # 合并连续相同发言人的句子
        merged_results = []
        current_speaker = None
        accumulated_text = ""
        accumulated_start_time = None
        accumulated_end_time = None

        for item in sentence_speakers:
            if current_speaker is None or current_speaker != item['speaker_id']:
                # 发言人切换或第一个句子
                if accumulated_text:  # 保存上一个发言人的内容
                    # 如果上一个发言人的最后一个字符是逗号，改为句号
                    if accumulated_text.endswith('，'):
                        accumulated_text = accumulated_text[:-1] + '。'
                    elif accumulated_text.endswith(','):
                        accumulated_text = accumulated_text[:-1] + '.'

                    # 计算合并后的总时长
                    total_duration_s = (accumulated_end_time - accumulated_start_time) / 1000.0

                    merged_results.append({
                        'speaker_id': current_speaker,
                        'text': accumulated_text,
                        'start_time_ms': accumulated_start_time,
                        'end_time_ms': accumulated_end_time,
                        'duration_s': total_duration_s
                    })

                # 开始新发言人
                current_speaker = item['speaker_id']
                accumulated_text = item['text']
                accumulated_start_time = item['start_time_ms']
                accumulated_end_time = item['end_time_ms']
            else:
                # 同一发言人，拼接文本和更新结束时间
                accumulated_text += item['text']
                accumulated_end_time = item['end_time_ms']  # 更新到最新的结束时间

        # 处理最后一个发言人
        if accumulated_text:
            total_duration_s = (accumulated_end_time - accumulated_start_time) / 1000.0
            merged_results.append({
                'speaker_id': current_speaker,
                'text': accumulated_text,
                'start_time_ms': accumulated_start_time,
                'end_time_ms': accumulated_end_time,
                'duration_s': total_duration_s
            })

        # 打印结果
        logger.info(f"合并前句子数: {len(sentences)}")
        logger.info(f"合并后句子数: {len(merged_results)}")

        for result in merged_results:
            logger.info(f"发言人 {result['speaker_id']} ({result['duration_s']:.2f}s): {result['text']}")

        return merged_results

    def _merge_short_segments(self, sentences):
        """合并时长不足1秒的短段落"""
        if not sentences:
            return sentences

        merged_sentences = []
        i = 0

        while i < len(sentences):
            current_sentence = sentences[i]

            # 计算当前句子的时长
            if current_sentence['timestamps']:
                start_time_ms = current_sentence['timestamps'][0][0]
                end_time_ms = current_sentence['timestamps'][-1][1]
                duration_ms = end_time_ms - start_time_ms

                if duration_ms < 1600 or len(current_sentence['words']) < 3:
                    # 尝试与前面段落合并
                    if merged_sentences:
                        # 与前面段落合并
                        prev_sentence = merged_sentences[-1]
                        merged_sentences[-1] = {
                            'text': prev_sentence['text'] + current_sentence['text'],
                            'words': prev_sentence['words'] + current_sentence['words'],
                            'timestamps': prev_sentence['timestamps'] + current_sentence['timestamps']
                        }
                        logger.info(f"短段落与前面合并: '{current_sentence['text']}' (时长: {duration_ms}ms)")

                    # 尝试与后面段落合并
                    elif i + 1 < len(sentences):
                        # 与后面段落合并
                        next_sentence = sentences[i + 1]
                        merged_sentence = {
                            'text': current_sentence['text'] + next_sentence['text'],
                            'words': current_sentence['words'] + next_sentence['words'],
                            'timestamps': current_sentence['timestamps'] + next_sentence['timestamps']
                        }
                        merged_sentences.append(merged_sentence)
                        logger.info(f"短段落与后面合并: '{current_sentence['text']}' + '{next_sentence['text']}' (时长: {duration_ms}ms)")
                        i += 1  # 跳过下一个句子，因为已经合并了

                    # 无法合并，自己一段
                    else:
                        merged_sentences.append(current_sentence)
                        logger.info(f"短段落无法合并，独立一段: '{current_sentence['text']}' (时长: {duration_ms}ms)")
                else:
                    # 时长足够，直接添加
                    merged_sentences.append(current_sentence)
            else:
                # 没有时间戳，直接添加
                merged_sentences.append(current_sentence)

            i += 1

        return merged_sentences

    def _fallback_speaker_identification(self, text):
        """兜底的发言人识别方案：直接使用原音频进行发言人识别"""
        try:
            # 获取原音频缓冲区
            wav_buffer = self.pooled_asr_model.get_streaming_model().get_wav_buffer()

            if len(wav_buffer) == 0:
                logger.warning("音频缓冲区为空，无法进行发言人识别")
                return [{'speaker_id': '0', 'text': text}]

            # 直接对整个音频进行发言人识别
            speaker_id, speaker_distance = self.pooled_speaker_clustering.speaker_clustering.cluster(wav_buffer)

            logger.info(f"兜底发言人识别结果: '{text}' -> 发言人: {speaker_id}")

            return [{
                'speaker_id': speaker_id,
                'text': text
            }]

        except Exception as e:
            logger.error(f"兜底发言人识别失败: {e}")
            # 如果连兜底都失败，返回默认发言人
            return [{'speaker_id': '0', 'text': text}]

    def _process_audio_frame(self, audio_bytes):
        """处理音频帧的核心逻辑"""
        if not self.pooled_detector or not self.pooled_asr_model or not self.pooled_speaker_clustering:
            logger.error("模型实例未获取，无法处理音频帧")
            return []

        results = []

        # 将输入音频转换为int16格式
        input_audio = np.frombuffer(audio_bytes, dtype=np.int16)

        # 根据自动增益开关决定处理方式
        if self.enable_auto_gain and self.audio_gain_controller:
            # 使用增益控制器处理音频
            current_frame = self.audio_gain_controller.process_audio_frame(input_audio)

            # 如果返回空数组，说明窗口还没准备好
            if len(current_frame) == 0:
                return []
        else:
            # 如果关闭自动增益，直接使用原音频
            current_frame = input_audio

        if self.is_debug:
            if len(self.audio_buffer) == 0:
                self.audio_buffer = current_frame.copy()
            else:
                self.audio_buffer = np.concatenate((self.audio_buffer, current_frame))

        # 对增益后的当前帧进行detect
        wav_np = current_frame.astype(np.float32)
        detect_result = self.pooled_detector.detector.detect(wav_np)
        streaming_model = self.pooled_asr_model.get_streaming_model()

        for frame_np, is_speech in detect_result:
            self.begin_ts = self.sample_count/self.sample_rate + self.client_time
            if is_speech:
                streaming_model.input(frame_np)

                # 流式音量检测 - 每帧都进行检测
                if self.enable_volume_detection and self.volume_detector:
                    # 音量检测器内部会处理音频格式转换、归一化和异常处理
                    self.volume_detector.add_audio_frame(frame_np)

            if is_speech and not self.speech_state:
                results.append(self.gen_result("begin", begin_ts = self.begin_ts))
                self.next_transcribe_time = (time.time() - self.connection_start_time) + self.transcribe_interval
            elif self.speech_state and not is_speech:
                offline_results, cost = self.transcribe_offline()
                logger.info(f"离线识别结果: {offline_results}")

                if len(offline_results) > 0:
                    for sentence in offline_results:
                        text = sentence['text']
                        speaker_id = sentence['speaker_id']
                        sentence.get('duration_s', 1)
                        results.append(self.gen_result("end", text, cost, speaker_id, begin_ts=self.begin_ts))

                        # AI建议
                        if self.streaming_advice and text and text.strip():
                            self.streaming_advice.add_text(text)

                        self.sentence_id += 1
                        logger.info(f"句子: '{text}' -> 发言人: {speaker_id} -> 识别耗时: {cost}s")
                else:
                    logger.info("not recognize sentences")
                    results.append(self.gen_result("end", '', cost, '0', begin_ts=self.begin_ts))
                    self.sentence_id += 1

                streaming_model.clear_state()
            elif self.speech_state:
                cur_ts = time.time() - self.connection_start_time
                if cur_ts >= self.next_transcribe_time:
                    text, cost = self.transcribe()
                    if text.strip() == '.' or text.strip() == '。':
                        text = ''
                    results.append(self.gen_result("changed", text, cost, begin_ts=self.begin_ts))
                    self.next_transcribe_time = cur_ts + self.transcribe_interval

            self.speech_state = is_speech
            self.sample_count += len(frame_np)

        return results

    def recognize(self, audio_bytes):
        """识别音频数据"""
        if not self.pooled_detector or not self.pooled_asr_model or not self.pooled_speaker_clustering:
            logger.error("模型实例未获取，无法识别音频")
            return []

        if self.enable_async and self.result_callback:
            # 异步模式
            try:
                self.audio_frame_queue.put_nowait(audio_bytes)
                return []
            except queue.Full:
                logger.warning("音频帧队列已满，丢弃当前帧")
                return []
        else:
            # 同步模式
            return self._process_audio_frame(audio_bytes)


    def get_advice_status(self) -> dict:
        """获取AI建议系统状态"""
        if self.streaming_advice:
            return self.streaming_advice.get_status()
        else:
            return {"advice_enabled": False}

    def stop_async_processing(self):
        """停止异步处理"""
        if self.worker_thread and self.worker_thread.is_alive():
            self.stop_worker = True
            self.worker_thread.join(timeout=2.0)
            logger.info("异步识别工作线程已停止")

    def __del__(self):
        """析构函数，确保资源正确释放"""
        self.release_models()
