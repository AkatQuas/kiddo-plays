# Audio Course 代码摘录

学习 [Hugging Face Audio Course](https://huggingface.co/learn/audio-course) 时整理的 Python 代码片段，涵盖音频数据处理、音频分类、自动语音识别（ASR）、文本转语音（TTS），以及将多个模型串联起来的语音应用。

这些文件适合配合课程逐段阅读、修改和实验。模型名称、数据集和训练参数大多直接写在脚本中，部分代码保留了课程时期的 API；运行前请结合下方说明检查环境与参数。

## 内容导航

目录按主题组织，建议依次阅读 `audio_course` → `application` → `recognition` → `text_to_speech` → `speech_to_speech`。

### 音频基础 · `src/audio_course/`

| 文件 | 内容 |
| --- | --- |
| [figures.py](src/audio_course/figures.py) | 波形、离散傅里叶变换（DFT）、频谱、频谱图与 Mel 频谱图 |
| [data_sets.py](src/audio_course/data_sets.py) | 加载 MINDS-14 数据集、读取音频与意图标签、构建音频预览界面 |
| [upsample.py](src/audio_course/upsample.py) | 按时长过滤音频、重采样到 16 kHz、提取 Whisper 输入特征 |
| [streaming_mode.py](src/audio_course/streaming_mode.py) | 以流式方式读取 GigaSpeech，并取出少量样本 |
| [gr_demo.py](src/audio_course/gr_demo.py) | 最小 Gradio 文本交互示例 |

### 音频分类与生成 · `src/application/`

| 文件 | 内容 |
| --- | --- |
| [classification.py](src/application/classification.py) | 使用预训练模型识别 MINDS-14 音频的意图类别 |
| [classify_gradio.py](src/application/classify_gradio.py) | 使用微调后的 DistilHuBERT 构建音乐流派分类界面 |
| [fin_tune.py](src/application/fin_tune.py) | 在 GTZAN 上微调 DistilHuBERT，包含特征处理、训练与准确率评估 |
| [generation.py](src/application/generation.py) | 使用 Bark 生成语音，使用 MusicGen 根据文本生成音乐 |

### 自动语音识别 · `src/recognition/`

| 文件 | 内容 |
| --- | --- |
| [recognition.py](src/recognition/recognition.py) | 使用 Wav2Vec2 进行英语和德语语音识别 |
| [ctc.py](src/recognition/ctc.py) | CTC 与 Whisper Seq2Seq 推理、语音翻译，以及长音频分块处理 |
| [evaluation.py](src/recognition/evaluation.py) | 词错误率（WER）计算，以及文本归一化对评估的影响 |
| [normalize.py](src/recognition/normalize.py) | 批量运行 Whisper，比较原始文本与归一化文本的 WER |
| [fine_tune.py](src/recognition/fine_tune.py) | Whisper 微调流程：数据预处理、批次填充、训练与 WER 评估 |
| [gradio_demo.py](src/recognition/gradio_demo.py) | 支持麦克风录音和文件上传的语音转写界面 |

### 文本转语音 · `src/text_to_speech/`

| 文件 | 内容 |
| --- | --- |
| [speecht5.py](src/text_to_speech/speecht5.py) | SpeechT5 文本编码、说话人嵌入，以及 HiFi-GAN 声码器合成 |
| [bark.py](src/text_to_speech/bark.py) | Bark 多语言语音生成、音色预设、非语言声音提示与批量生成 |
| [massive_multilingual_speech.py](src/text_to_speech/massive_multilingual_speech.py) | 使用 MMS / VITS 模型生成德语语音 |

### 组合语音应用 · `src/speech_to_speech/`

| 文件 | 内容 |
| --- | --- |
| [speech_translation.py](src/speech_to_speech/speech_translation.py) | Whisper 将语音翻译为英文文本，再通过 SpeechT5 合成为语音，附 Gradio 界面 |
| [meeting.py](src/speech_to_speech/meeting.py) | 将说话人分离与语音识别结合，生成包含说话人和时间戳的转写 |
| [voice_assistant.py](src/speech_to_speech/voice_assistant.py) | 串联唤醒词检测、麦克风转写、远程语言模型查询和语音合成 |

## 环境准备

项目使用 [uv](https://docs.astral.sh/uv/) 管理依赖，`.python-version` 指定 Python 3.12；依赖声明见 [pyproject.toml](pyproject.toml)，版本锁定见 [uv.lock](uv.lock)。

从上一级目录进入项目并安装锁定的依赖：

```bash
cd audio-course
uv sync --locked
```

主要依赖包括 Transformers、Datasets、PyTorch、Librosa、Evaluate 和 Gradio；说话人分离示例还使用 Pyannote Audio 与 Speechbox。音频解码和麦克风采集可能需要系统安装 FFmpeg，例如：

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
```

首次运行涉及模型或数据集的脚本时会从 Hugging Face Hub 下载相应资源。部分资源需要先在其页面接受使用条款或申请访问权限，然后在本地登录：

```bash
uv run hf auth login
```

## 运行示例

以下命令均在 `audio-course/` 目录执行，按需选择单个脚本：

```bash
# 绘制波形、频谱和 Mel 频谱图
uv run python src/audio_course/figures.py

# 查看流式数据集的前两个样本
uv run python src/audio_course/streaming_mode.py

# 计算 WER，并观察文本归一化的效果
uv run python src/recognition/evaluation.py

# SpeechT5 语音合成
uv run python src/text_to_speech/speecht5.py

# 启动语音转写的 Gradio 界面
uv run python src/recognition/gradio_demo.py
```

`figures.py` 末尾的 `plt.show()` 默认被注释，若要弹出图窗，需要先取消注释。Gradio 示例启动后，可打开终端输出的地址访问界面。

项目声明的 `uv run audio-course` 入口目前只打印问候信息；具体实验通过对应的 Python 文件运行。

## 阅读与运行提示

- **交互式输出**：不少片段仅求值而没有 `print()`，或使用 `IPython.display.Audio`。在普通终端运行时不会自动展示这些结果或播放音频；可以在 Notebook 中逐段执行并显式展示，或自行添加打印、保存音频等操作。
- **库版本差异**：代码中仍有 `gr.outputs.Label()`、`gr.Audio(source=...)`、Pyannote 的旧鉴权参数等写法，可能需要按当前依赖版本调整。新版 Datasets 的音频解码对象也可能与片段使用的 `audio["array"]` / `audio["sampling_rate"]` 字典格式不同。锁定依赖不代表所有课程片段都已适配这些版本。
- **训练参数**：两个微调脚本都启用了 `fp16`；Whisper 微调还启用了 TensorBoard 日志。训练前需要按设备调整精度、批次大小和训练步数，并按需安装 `accelerate`、`tensorboard` 等训练依赖。部分脚本仅检测 CUDA，否则使用 CPU，未自动选择 Apple Silicon 的 MPS。
- **语言设置**：`recognition/fine_tune.py` 使用 Common Voice 的 `dv` 数据，但处理器和生成参数设置为 `sinhalese`，配套转写界面也保留了这一设置。实验前应根据目标语言统一数据集、语言参数和模型。
- **组合应用**：`meeting.py` 使用课程时期的 Pyannote 模型与接口；`voice_assistant.py` 使用旧的远程推理端点。复现这些流程时，需要核对当前模型访问方式与服务 API，并为麦克风采集准备设备权限。
- **脚本执行方式**：多数文件在顶层直接下载数据、加载模型、启动界面或训练，导入模块也会触发这些操作。建议先阅读脚本，再挑选所需片段执行。

## 参考资料

- [Hugging Face Audio Course](https://huggingface.co/learn/audio-course)：课程原文与完整讲解。
- [Transformers 文档](https://huggingface.co/docs/transformers/index)：模型加载、推理与训练 API。
- [Datasets 音频处理文档](https://huggingface.co/docs/datasets/audio_process)：音频读取、重采样与预处理。
- [Gradio 文档](https://www.gradio.app/docs)：交互界面组件与当前用法。
