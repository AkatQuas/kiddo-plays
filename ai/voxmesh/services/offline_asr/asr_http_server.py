import argparse
import asyncio
import io
import json
import os
import time
import uuid

import bootstrap  # noqa: F401 — ensure sys.path before other imports

parser = argparse.ArgumentParser()
parser.add_argument(
    "--host", type=str, default="0.0.0.0", required=False, help="host ip, localhost, 0.0.0.0"
)
parser.add_argument("--port", type=int, default=34001, required=False, help="server port")
parser.add_argument(
    "--asr_model",
    type=str,
    default="paraformer-zh",
    help="asr model from https://github.com/alibaba-damo-academy/FunASR?tab=readme-ov-file#model-zoo",
)
parser.add_argument(
    "--english_asr_model",
    type=str,
    default="Whisper-large-v3",
    help="asr model from https://github.com/alibaba-damo-academy/FunASR?tab=readme-ov-file#model-zoo",
)
parser.add_argument(
    "--vad_model",
    type=str,
)
parser.add_argument(
    "--punc_model",
    type=str,
    default="ct-punc-c",
    help="model from https://github.com/alibaba-damo-academy/FunASR?tab=readme-ov-file#model-zoo",
)
parser.add_argument(
    "--spk_model",
    type=str,
    default="ct-punc-c",
    help="model from https://github.com/alibaba-damo-academy/FunASR?tab=readme-ov-file#model-zoo",
)
parser.add_argument("--temp_dir", type=str, default="temp_dir/", required=False, help="temp dir")
parser.add_argument("--device", type=str, default="cuda:0", help="运行设备的类型 (cuda, cpu)")
parser.add_argument("--log_dir", type=str, default="./offline_asr", required=False, help="log dir")
parser.add_argument(
    "--embedding_model_dir",
    type=str,
    default="$INPUT_PATH/speech_campplus_sv_zh-cn_16k-common",
    help="说话人特征提取模型路径"
)
parser.add_argument(
    "--model_type",
    type=str,
    default="campplus",
    choices=["speechbrain", "campplus"],
    help="embedding模型类型"
)
parser.add_argument(
    "--min_duration",
    type=float,
    default=10.0,
    help="最小音频时长（秒）"
)
parser.add_argument(
    "--segmentation_model_path",
    type=str,
    default=None,
    help="分割模型路径（用于语音段分割）"
)
parser.add_argument(
    "--hotword_api_url",
    type=str,
    default=os.getenv("HOTWORD_API_URL", os.getenv("LLM_API_URL", "http://localhost:11434/v1")),
    help="热词纠错API地址 (OpenAI-compatible, default: Ollama)"
)
parser.add_argument(
    "--hotword_api_key",
    type=str,
    default=os.getenv("HOTWORD_API_KEY", os.getenv("LLM_API_KEY", "ollama")),
    help="热词纠错API密钥"
)
parser.add_argument(
    "--hotword_model",
    type=str,
    default=os.getenv("HOTWORD_MODEL", os.getenv("LLM_MODEL", "qwen2.5:7b")),
    help="热词纠错模型名称"
)
args = parser.parse_args()

from logger_config import get_logger, setup_logger
from voxmesh.app.offline import OfflineApp
from voxmesh.version import get_version

setup_logger(args.log_dir)
logger = get_logger()


# 华为NPU条件导入
if os.getenv('HW_ENABLE'):
    try:
        import torch_npu  # noqa: F401
        from torch_npu.contrib import transfer_to_npu  # noqa: F401
        logger.info("华为NPU环境已启用，成功导入torch_npu")
    except ImportError as e:
        logger.warning(f"华为NPU环境变量已设置，但导入torch_npu失败: {e}")

import ffmpeg
import uvicorn
from asr_model import AsrModel
from embedding_service import EmbeddingRequest, EmbeddingResponse
from fastapi import Body, FastAPI, Query
from hotword_corrector import get_hotword_corrector
from pydub import AudioSegment
from utils.protocol import AsrResponse, AsyncRequest
from utils.utils import down_file, write_asr_response_to_json

logger.info(f"当前版本: {get_version()}")

logger.info("-----------  Configuration Arguments -----------")
for arg, value in vars(args).items():
    logger.info("%s: %s" % (arg, value))
logger.info("------------------------------------------------")

os.makedirs(args.temp_dir, exist_ok=True)
logger.info(f"model loading at {time.time()}")
# load funasr model
model = AsrModel(
    model=args.asr_model,
    trust_remote_code=True,
    vad_model=args.vad_model,
    punc_model=args.punc_model,
    spk_model=args.spk_model,
    remote_code="./model.py",
    disable_pbar=True,
    disable_update=True,
    device=args.device,
    enable_batchsize=True,
    ngpu=1,
)
model_english = AsrModel(
    model=args.english_asr_model,
    trust_remote_code=True,
    vad_model=args.vad_model,
    punc_model=args.punc_model,
    spk_model=args.spk_model,
    remote_code="./model.py",
    disable_pbar=True,
    disable_update=True,
    device=args.device,
    enable_batchsize=False,
    ngpu=1,
)
logger.info(f"loaded models finish at {time.time()}")
logger.info(f"args.asr_model is {args.asr_model}, args.english_asr_model is {args.english_asr_model}!")

# 加载embedding服务
logger.info("开始初始化embedding服务...")
embedding_service = None
try:
    from embedding_service import EmbeddingService
    embedding_service = EmbeddingService(
        embedding_model_dir=args.embedding_model_dir,
        model_type=args.model_type,
        device=args.device,
        min_duration=args.min_duration,
        segmentation_model_path=args.segmentation_model_path
    )
    if embedding_service.is_model_loaded():
        logger.info("Embedding服务初始化成功")
    else:
        logger.error(f"Embedding模型加载失败: {embedding_service.model_load_error}")
except Exception as e:
    logger.error(f"Embedding服务初始化失败: {e}")
    embedding_service = None

offline_app = OfflineApp.build(
    args=args,
    model=model,
    model_english=model_english,
    embedding_service=embedding_service,
)
model_lock = offline_app.model_lock
version = offline_app.version
param_dict = offline_app.param_dict

app = FastAPI(
    title="FunASR with Embedding",
    version=version,
    description="ASR HTTP服务，支持语音识别和说话人特征提取"
)

async def perform_recognition(json_path: str, audio_path: str, dir_path: str, speakers=None, hotword=None, spk_num=0, lang='zh'):
    """异步执行识别任务."""
    logger.info(f"开始异步识别任务: {audio_path}")

    try:
        audio = AudioSegment.from_file(audio_path)
        audio_duration = len(audio) / 1000.0  # 转换为秒
        logger.info(f"音频时长: {audio_duration:.2f}秒，将整体送入模型进行识别")

        msg = ""

        try:
            # 准备识别参数
            recognition_params = param_dict.copy()
            if speakers:
                recognition_params['speakers'] = speakers
                logger.info(f"传递speakers参数: {len(speakers)} 个预定义说话人")
            if hotword:
                recognition_params['hotword'] = hotword
                logger.info(f"传递hotword参数: {hotword}")
            if spk_num > 0:
                recognition_params['preset_spk_num'] = spk_num
                logger.info(f"传递spk_num参数: {spk_num}")

            async with model_lock:
                if lang == 'en':
                    logger.info("尝试使用英文模型")
                    rec_results = await asyncio.to_thread(model_english.generate, input=audio_path, is_final=True,
                                                          **recognition_params)
                else:
                    logger.info("尝试使用中文模型")
                    rec_results = await asyncio.to_thread(model.generate, input=audio_path, is_final=True, **recognition_params)
        except Exception as e:
            logger.error(f"音频识别失败: {e}")
            import traceback
            traceback.print_exc()
            msg = f"音频识别失败: {str(e)}"

        # 处理识别结果
        if msg:
            logger.error(f"识别过程中出现错误: {msg}")
            write_asr_response_to_json(AsrResponse(msg=msg, code=1, data={"text": "", "sentences": ""}), json_path)
        elif len(rec_results) == 0:
            logger.warning("音频识别结果为空")
            write_asr_response_to_json(AsrResponse(data={"text": "", "sentences": []}), json_path)
        elif len(rec_results) == 1:
            rec_result = rec_results[0]
            if not rec_result["text"]:
                logger.warning("音频识别文本为空")
                write_asr_response_to_json(AsrResponse(data={"text": "", "sentences": []}), json_path)
            else:
                text, sentences = rec_result["text"], rec_result["sentence_info"]
                logger.info(f"音频识别成功: {text}")

                [s.pop("timestamp") for s in sentences]

                # 如果传入了hotword且len > 0，则调用大模型批量纠错sentences中的文本
                if hotword and len(hotword) > 0:
                    logger.info(f"开始进行热词批量纠错，热词数量: {len(hotword)}")
                    corrector = get_hotword_corrector(
                        api_url=args.hotword_api_url,
                        api_key=args.hotword_api_key,
                        model=args.hotword_model
                    )
                    if corrector and corrector.is_available():
                        # 提取所有句子的文本
                        original_texts = [sentence.get("text", "") for sentence in sentences]

                        # 批量纠错，每次最多100句
                        corrected_texts = corrector.correct_texts_batch_with_hotwords(original_texts, hotword, batch_size=100)

                        # 更新sentences中的text字段
                        for i, sentence in enumerate(sentences):
                            if i < len(corrected_texts):
                                sentence["text"] = corrected_texts[i]

                        # 更新总文本
                        text = "".join(corrected_texts)
                        logger.info(f"热词批量纠错完成，纠错后文本: {text}")
                    else:
                        logger.warning("热词纠错器不可用，跳过纠错")

                logger.info(f"异步识别任务完成，总句子数: {len(sentences)}")
                write_asr_response_to_json(AsrResponse(data={"text": text, "sentences": sentences, "version": version}), json_path)
        else:
            logger.error(f"音频返回了多个结果: {len(rec_results)}")
            msg = "音频返回了未预期的结果数量"
            write_asr_response_to_json(AsrResponse(msg=msg, code=1, data={"text": "", "sentences": ""}), json_path)

    except Exception as e:
        logger.error(f"异步识别任务异常: {e}", exc_info=True)
        write_asr_response_to_json(AsrResponse(msg=str(e), code=1, data={"text": "", "sentences": ""}), json_path)
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)
            logger.info(f"成功删除临时音频文件：{audio_path}")


@app.post("/recognition")
async def api_recognition(
        audio: bytes = Body(..., description="audio file in bytes")):
    suffix = "wav"
    audio_path = f"{args.temp_dir}/{str(uuid.uuid1())}.{suffix}"
    start_time = time.time()

    logger.info(f"收到同步识别请求，音频大小: {len(audio)} bytes")

    try:
        audio_stream = io.BytesIO(audio)
        audio_segment = AudioSegment.from_file(audio_stream)
        audio_segment.export(audio_path, format="wav")

        audio_t = float(ffmpeg.probe(audio_path)['format']['duration'])
        logger.info(f"音频时长: {audio_t:.2f}秒")

        if audio_t > 7200:
            logger.warning(f"音频文件超过2小时限制: {audio_t:.2f}秒")
            return AsrResponse(msg="音频文件超2小时", code=1, data={"text": "", "sentences": ""})

        logger.info("开始ASR识别")
        # 准备识别参数
        recognition_params = param_dict.copy()
        # 注意：同步接口暂时不支持speakers和hotword参数
        # 如需使用这些功能，请使用异步接口 /async_recognition

        async with model_lock:
            rec_results = await asyncio.to_thread(model.generate, input=audio_path, is_final=False, **recognition_params)

        # 处理识别结果
        if len(rec_results) == 0:
            logger.warning("ASR识别结果为空")
            return AsrResponse(data={"text": "", "sentences": ""})
        elif len(rec_results) == 1:
            rec_result = rec_results[0]
            if not rec_result["text"]:
                logger.warning("ASR识别文本为空")
                return AsrResponse(data={"text": "", "sentences": ""})

            text, sentences = rec_result["text"], rec_result["sentence_info"]
            [s.pop("timestamp") for s in sentences]
            for sentence in sentences:
                sentence["start"] = sentence["start"]
                sentence["end"] = sentence["end"]

            logger.info(f"同步识别成功，耗时: {time.time() - start_time:.2f}s，结果: {text}")
            return AsrResponse(data={"text": text, "sentences": sentences, "version": version})
        else:
            logger.error(f"ASR返回了多个结果: {len(rec_results)}")
            return AsrResponse(msg="未知错误", code=1, data={"text": "", "sentences": ""})

    except Exception as e:
        logger.error(f"同步识别异常: {e}", exc_info=True)
        return AsrResponse(msg=str(e), code=1, data={"text": "", "sentences": ""})
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)
            logger.info(f"成功删除临时音频文件：{audio_path}")


@app.post("/async_recognition")
async def async_recognition(item: AsyncRequest):
    suffix = "wav"
    uid = f"{uuid.uuid1()}-{str(int(time.time()))}"
    filekey = item.filekey
    filePath = item.filePath

    logger.info(f"收到异步识别请求，filekey: {filekey}, filePath: {filePath}, query_id: {uid}")

    try:
        dir_path = f"{args.temp_dir}/{str(uid)}"
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            logger.info(f"创建任务目录: {dir_path}")

        audio_path = f"{dir_path}/{str(uid)}.{suffix}"
        json_path = f"{dir_path}/{str(uid)}.json"

        # 首先检查filePath是否存在
        if filePath and os.path.exists(filePath):
            logger.info(f"复制本地文件: {filePath} -> {audio_path}")
            start_time = time.time()
            import shutil
            shutil.copy2(filePath, audio_path)
            logger.info(f"文件复制完成，耗时: {time.time() - start_time:.2f}s")
        else:
            # 如果本地文件不存在，则下载文件
            logger.info(f"本地文件不存在，开始下载文件: {filekey}")
            start_time = time.time()
            if down_file(filekey, audio_path):
                logger.info(f"文件下载完成，耗时: {time.time() - start_time:.2f}s")
                audio_t = float(ffmpeg.probe(audio_path)['format']['duration'])
                logger.info(f"音频时长: {audio_t:.2f}秒，启动异步识别任务")
            else:
                logger.error(f"文件下载失败: {filekey}")
                audio_t = 0
                write_asr_response_to_json(AsrResponse(data={"text": "", "sentences": []}), json_path)
                if os.path.exists(audio_path):
                    os.remove(audio_path)
                    logger.info(f"成功删除临时音频文件：{audio_path}")
                return AsrResponse(data={"query_id": str(uid), "audio_duration": audio_t})

        audio_t = float(ffmpeg.probe(audio_path)['format']['duration'])
        logger.info(f"音频时长: {audio_t:.2f}秒，启动异步识别任务")

        asyncio.create_task(perform_recognition(json_path, audio_path, dir_path, speakers=item.speakers, hotword=item.hotword, spk_num=item.spk_num, lang=item.lang))

        logger.info(f"异步识别任务已启动，query_id: {uid}")
        return AsrResponse(data={"query_id": str(uid), "audio_duration": audio_t})

    except Exception as e:
        logger.error(f"异步识别请求处理失败: {e}", exc_info=True)
        return AsrResponse(msg=str(e), code=1, data={"text": ""})


@app.get("/get_recognition")
async def get_recognition(query_id: str = Query(..., description="查询query_id")):
    logger.info(f"查询识别结果，query_id: {query_id}")

    dir_path = f"{args.temp_dir}/{str(query_id)}"
    json_path = f"{dir_path}/{str(query_id)}.json"
    audio_path = f"{dir_path}/{str(query_id)}.wav"

    try:
        if not os.path.exists(json_path):
            if not os.path.exists(audio_path):
                logger.warning(f"任务不存在: {query_id}")
                return AsrResponse(msg="任务不存在", code=1, data={"text": "", "sentences": []})
            else:
                logger.info(f"任务处理中: {query_id}")
                return AsrResponse(msg="文本转换中", code=2, data={"text": "", "sentences": []})
        else:
            logger.info(f"返回识别结果: {query_id}")
            with open(json_path, "r") as f:
                data = json.load(f)
                return AsrResponse(**data)
    except Exception as e:
        logger.error(f"查询识别结果异常，query_id: {query_id}, 错误: {e}", exc_info=True)
        return AsrResponse(msg=str(e), code=1, data={"text": "", "sentences": []})

@app.post("/embedding_extract")
async def extract_embedding(request: EmbeddingRequest = Body(...)):
    """
    提取说话人特征
    Args:
        request: 特征提取请求，包含wav_data（base64编码的WAV数据）

    Returns:
        EmbeddingResponse: 特征提取响应
    """

    if not offline_app.is_embedding_available():
        return EmbeddingResponse(
            code=1004,
            message="Embedding服务未正确初始化"
        )

    try:
        # 检查必需参数
        if not hasattr(request, 'wav_data') or not request.wav_data:
            return EmbeddingResponse(
                code=1006,
                message="参数错误，缺少wav_data参数"
            )

        # 调用embedding服务处理请求
        return await embedding_service.process_embedding_request(request)

    except Exception as e:
        logger.error(f"处理特征提取请求失败: {e}")
        return EmbeddingResponse(
            code=1005,
            message=f"服务器内部错误: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """健康检查接口"""
    health_status = {
        "status": "healthy",
        "version": version,
        "services": {
            "asr": "enabled",
            "embedding": "enabled" if offline_app.is_embedding_available() else "disabled"
        }
    }
    if embedding_service and not offline_app.is_embedding_available():
        health_status["embedding_error"] = embedding_service.model_load_error
    return health_status

if __name__ == "__main__":
    uvicorn.run(
        app, host=args.host, port=args.port
    )
