from abc import ABC, abstractmethod


class ASROfflineBase(ABC):
    """ASR离线识别基类"""

    @abstractmethod
    def __init__(self, model_dir, **kwargs):
        """
        初始化离线ASR模型
        Args:
            model_dir: 模型路径
            **kwargs: 其他参数
        """
        pass

    @abstractmethod
    def transcribe(self, wav_buffer):
        """
        离线转录音频
        Args:
            wav_buffer: 音频数据缓冲区
        Returns:
            str: 识别文本
        """
        pass


class ASRStreamingBase(ABC):
    """ASR流式识别基类"""

    @abstractmethod
    def __init__(self, model_dir, **kwargs):
        """
        初始化流式ASR模型
        Args:
            model_dir: 模型路径
            **kwargs: 其他参数，可能包含:
                - device: 设备类型
                - vad_model: VAD模型路径
                - punc_model: 标点模型路径
                - spk_model: 说话人模型路径
                - 等其他模型特定参数
        """
        pass

    @abstractmethod
    def input(self, streaming_wav_np):
        """
        输入音频流数据
        Args:
            streaming_wav_np: 音频numpy数组
        """
        pass

    @abstractmethod
    def get_wav_buffer(self):
        """
        获取当前音频缓冲区
        Returns:
            numpy.ndarray: 音频缓冲区
        """
        pass

    @abstractmethod
    def get_input_length(self):
        """
        获取输入音频长度
        Returns:
            int: 音频样本数
        """
        pass

    @abstractmethod
    def transcribe(self):
        """
        流式转录当前缓冲区音频
        Returns:
            str: 识别文本
        """
        pass

    @abstractmethod
    def transcribe_with_timestamp(self):
        """
        流式转录当前缓冲区音频，包含时间戳
        Returns:
            dict: 包含文本和时间戳的结果
        """
        pass


    @abstractmethod
    def clear_state(self):
        """清除当前状态"""
        pass
