#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
语音唤醒服务器
基于WebSocket的关键词检测服务
"""

import argparse
import asyncio
import json
import os

import websockets
from funasr import AutoModel
from fuzzywuzzy import fuzz
from logger_config import get_logger, setup_logger
from pypinyin import Style, pinyin

parser = argparse.ArgumentParser(description="语音唤醒服务器")
parser.add_argument(
    "--host", type=str, default="0.0.0.0", required=False, help="host ip, localhost, 0.0.0.0"
)
parser.add_argument("--port", type=int, default=34010, required=False, help="WebSocket server port")
parser.add_argument(
    "--asr_model",
    type=str,
    default="$INPUT_PATH/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    help="ASR模型路径",
)
parser.add_argument(
    "--vad_model",
    type=str,
    default="$INPUT_PATH/speech_fsmn_vad_zh-cn-16k-common-pytorch",
    help="VAD模型路径",
)
parser.add_argument("--device", type=str, default="cuda:0", help="运行设备的类型 (cuda, cpu)")
parser.add_argument("--keywords", type=str, default="你好助手", required=False, help="要检测的关键词")
parser.add_argument("--similarity_threshold", type=int, default=80, help="相似度阈值 (0-100)")
parser.add_argument("--log_dir", type=str, default="./logs", required=False, help="日志目录")
args = parser.parse_args()

# 设置日志
setup_logger(args.log_dir)
logger = get_logger()

# --- 全局模型实例 ---
# 在服务器启动时加载一次模型，避免重复加载

model_config = {
    "device": args.device,
    "disable_pbar": True,  # 禁用tqdm进度条
    "disable_update": True,  # 禁用模型更新检查
    "disable_log": True,  # 禁用FunASR内部的日志
}

# 华为NPU条件导入
if os.getenv('HW_ENABLE'):
    try:
        import torch_npu  # noqa: F401
        from torch_npu.contrib import transfer_to_npu  # noqa: F401
        logger.info("华为NPU环境已启用，成功导入torch_npu")
    except ImportError as e:
        logger.warning(f"华为NPU环境变量已设置，但导入torch_npu失败: {e}")

# 展开环境变量路径
asr_model_path = os.path.expandvars(args.asr_model)
vad_model_path = os.path.expandvars(args.vad_model)

logger.info(f"正在加载ASR模型: {asr_model_path}")
logger.info(f"正在加载VAD模型: {vad_model_path}")
logger.info(f"使用设备: {args.device}")

# 标准唤醒词和它的标准拼音
TARGET_WAKEUP_WORD = args.keywords
# 把它转换成一个空格分隔的字符串 "xiao meng" 以便 fuzzywuzzy 处理
TARGET_PINYIN = ' '.join(p[0] for p in pinyin(TARGET_WAKEUP_WORD, style=Style.NORMAL))

# 相似度阈值，从命令行参数获取
SIMILARITY_THRESHOLD = args.similarity_threshold

# ASR模型
model_asr = AutoModel(model=asr_model_path, vad_model=vad_model_path, **model_config)
logger.info("FunASR 模型加载成功")
logger.info(f"关键词: {TARGET_WAKEUP_WORD}")
logger.info(f"相似度阈值: {SIMILARITY_THRESHOLD}")
logger.info(f"标准拼音: {TARGET_PINYIN}")


def find_wakeup_word_fuzzy(text: str) -> tuple:
    """
    在一小段文本中模糊查找唤醒词。

    使用 "滑动窗口 + 拼音模糊匹配" 的策略。

    Args:
        text (str): ASR识别出的文本，可能包含唤醒词。

    Returns:
        tuple: 一个元组 (is_found, matched_word, score)
               - is_found (bool): 是否找到了唤醒词。
               - matched_word (str or None): 在文本中实际匹配到的词。
               - score (int): 匹配的相似度分数。
    """
    if not text:
        return (False, None, 0)

    window_size = len(TARGET_WAKEUP_WORD)

    # 如果文本本身就比我们的唤醒词还短，那就没必要继续了
    if len(text) < window_size:
        return (False, None, 0)

    # 遍历所有可能的窗口
    for i in range(len(text) - window_size + 1):
        # 提取当前窗口的文本，例如 "你好晓萌" -> "你好", "好晓", "晓萌"
        window_text = text[i: i + window_size]

        # --- 拼音转换与模糊匹配 ---
        try:
            # 将窗口内的文本转换为拼音字符串
            window_pinyin = ' '.join(p[0] for p in pinyin(window_text, style=Style.NORMAL))

            # 使用 fuzzywuzzy 计算两个拼音字符串的相似度
            # fuzz.ratio() 返回一个 0-100 的整数
            score = fuzz.ratio(TARGET_PINYIN, window_pinyin)

            # --- 判断与返回 ---
            if score >= SIMILARITY_THRESHOLD:
                # 返回 True，并附上它在原文中匹配到的词和具体分数
                return (True, window_text, score)
        except Exception as e:
            # pypinyin 可能会对一些罕见字符或符号抛出异常，这里做个保护
            logger.debug(f"处理 '{window_text}' 时出错: {e}")
            continue

    # 如果遍历完所有窗口都没有找到匹配，则返回未找到
    return (False, None, 0)


async def kws_handler(websocket):
    """
    处理单个 WebSocket 连接的函数。
    每个客户端连接都会创建一个新的 kws_handler 协程。
    """

    client_address = websocket.remote_address
    logger.info(f"客户端 {client_address} 已连接。")

    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # 接收到的是音频数据块
                # 调用模型进行流式处理，is_final=False 表示音频流尚未结束
                results = model_asr.generate(
                    input=message,
                    hotword=args.keywords,
                )

                # 字典中 "text" 键对应关键词检测结果
                status = "rejected"
                keywords = ""
                scores = 0
                if len(results) == 1 and "text" in results[0] and len(results[0]["text"]) > 0:
                    text = results[0]["text"].replace(" ", "")  # 通常结果在第一个元素
                    logger.debug(f"识别文本: {text}")
                    is_found, matched_word, score = find_wakeup_word_fuzzy(text)
                    if is_found:
                        logger.info(f"检测到关键词: {matched_word} (相似度: {score}%)")
                        status = "detected"
                        keywords = args.keywords
                        scores = float(score / 100)
                    else:
                        logger.debug(f"未检测到关键词，最高相似度: {score}%")

                response = {
                    "status": status,
                    "keywords": keywords,
                    "scores": scores,
                    "client": str(client_address)  # 可选，方便调试
                }
                await websocket.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosedOK:
        logger.info(f"客户端 {client_address} 主动关闭连接。")
    except websockets.exceptions.ConnectionClosedError as e:
        logger.error(f"客户端 {client_address} 连接意外关闭: {e}")
    except Exception as e:
        logger.error(f"处理客户端 {client_address} 时发生错误: {e}")
    finally:
        logger.info(f"客户端 {client_address} 已断开连接。")


async def main():
    logger.info("WebSocket 唤醒词检测服务启动")
    logger.info(f"监听地址: ws://{args.host}:{args.port}")

    # 设置 ping_interval 和 ping_timeout 保持连接活跃，并能检测到死连接
    # max_size 设置大一些以防客户端发送大的初始数据块
    async with websockets.serve(kws_handler, args.host, args.port,
                                ping_interval=None,  # 禁用自动 ping 以自定义心跳
                                max_size=2 * 1024 * 1024):  # 约 2MB
        await asyncio.Future()  # 保持服务器永久运行，直到被中断


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("服务被手动中断。")
    except Exception as e:
        logger.error(f"服务启动时发生未捕获的异常: {e}")
