# ScreenParser

使用 [Ultralytics](https://docs.ultralytics.com/) 加载开源的 [Docling ScreenParser](https://huggingface.co/docling-project/ScreenParser) 权重，对屏幕截图中的 UI 元素进行目标检测。项目包含示例图片 `test.png` 和推理脚本 `predict.py`。

## 环境要求

- Python 3.12 或更高版本
- [uv](https://docs.astral.sh/uv/)
- 首次运行需联网获取模型权重（若本地缓存中尚无权重）

在项目目录下安装依赖：

```bash
uv sync
```

## 图片识别

从项目目录运行：

```bash
uv run python predict.py
```

脚本默认从 Hugging Face 加载 `docling-project/ScreenParser`，并对 `./test.png` 推理。首次运行时，Ultralytics 会下载模型并缓存到本机。

当前推理参数（定义在 `predict.py`）：

- `imgsz=1280`：推理尺寸。
- `conf=0.10`：置信度阈值，低于阈值的检测将被过滤。
- `iou=0.10`：NMS 的 IoU 阈值，用于抑制重叠检测框。
- `save=True`：保存绘制检测框的结果图片。
- `project="runs"`、`name="screenparser-predict"`：结果保存到 `runs/screenparser-predict/`。

脚本还会在终端输出每个检测框的类别、置信度和边界框。边界框格式为 `(x, y, width, height)`，坐标单位为图片像素，原点在图片左上角。

## 更换输入图片或参数

编辑 `predict.py` 中的 `source`，例如：

```python
source="./my-screenshot.png"
```

图片路径相对于运行命令时的当前目录。修改 `source`、`imgsz`、`conf` 或 `iou` 后，重新运行：

```bash
uv run python predict.py
```

Ultralytics 还支持图片目录、视频和摄像头等输入，详见 [预测文档](https://docs.ultralytics.com/modes/predict/)。

## 环境探测

运行以下命令可查看 PyTorch MPS 是否可用、当前机器架构，以及 Ultralytics 配置的数据集目录：

```bash
uv run python probe-env.py
```

该脚本只报告 MPS 的可用性，不会强制推理使用 MPS。`predict.py` 未指定 `device`，设备选择由 Ultralytics 处理。

## 模型权重

`predict.py` 使用模型标识符 `docling-project/ScreenParser`，由 Ultralytics/Hugging Face 获取模型。也可以从 [模型仓库](https://huggingface.co/docling-project/ScreenParser) 手动下载权重，并在 `predict.py` 中将模型标识符替换为本地权重路径。

## Acknowledgements

This folder builds upon [ScreenParse](https://arxiv.org/abs/2602.14276) by Gurbuz et al.

You can also fetch the [best.pt](./best.pt) file from [docling-project/ScreenParser](https://huggingface.co/docling-project/ScreenParser) manually.
