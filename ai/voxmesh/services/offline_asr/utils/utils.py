import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone

import requests
from logger_config import get_logger
from pydub import AudioSegment

from utils.protocol import AsrResponse

logger = get_logger()

API_KEY = os.getenv("API_KEY", "")
API_SECRET = os.getenv("API_SECRET", "").encode("utf-8")
API_ROUTE = os.getenv("API_ROUTE", "/api/v1/storage")
OSS_ENDPOINT = os.getenv("OSS_ENDPOINT", "")
OSS_DOWNLOAD_PATH = os.getenv("OSS_DOWNLOAD_PATH", "/object/download")
OSS_QUERY_PARAM = os.getenv("OSS_QUERY_PARAM", "object_key")

def generate_nonce() -> str:
    return str(time.time_ns())


def generate_signature(method: str, path: str, timestamp: str, nonce: str, query: str) -> str:
    message = f"{method}\n{path}\n{timestamp}\n{nonce}\n{query}"
    signature = hmac.new(API_SECRET, message.encode("utf-8"), hashlib.sha256)
    return signature.hexdigest()


def write_asr_response_to_json(asr_response: AsrResponse, filename: str):
    """
    将 AsrResponse 对象写入 JSON 文件 (同步).
    """
    try:
        logger.info(f"开始写入ASR识别结果到文件: {filename}")
        with open(filename, "w") as f:
            json.dump(asr_response.dict(), f, indent=4, ensure_ascii=False)  # 使用 .dict() 获取 Pydantic 模型的字典表示
        logger.info(f"成功写入ASR识别结果到文件: {filename}")
    except Exception as e:
        logger.error(f"写入ASR识别结果到文件失败 {filename}: {e}")


def down_file(filekey, audio_path):
    if not OSS_ENDPOINT or not API_KEY or not API_SECRET:
        raise RuntimeError(
            "OSS download is not configured. Set OSS_ENDPOINT, API_KEY, and API_SECRET."
        )
    url = f"{OSS_ENDPOINT}{API_ROUTE}{OSS_DOWNLOAD_PATH}"
    logger.info(f"开始下载文件: filekey={filekey}, 目标路径={audio_path}")
    logger.debug(f"下载URL: {url}")

    try:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        nonce = generate_nonce()
        query = f"{OSS_QUERY_PARAM}={filekey}"
        signature = generate_signature("GET", f"{API_ROUTE}{OSS_DOWNLOAD_PATH}", timestamp, nonce, query)

        headers = {
            "Authorization": f"{API_KEY}#@#{timestamp}#@#{nonce}#@#{signature}",
        }
        logger.debug(f"请求头: {headers}")
        logger.debug(f"请求参数: {OSS_QUERY_PARAM}={filekey}")

        start_time = time.time()
        response = requests.get(url, params={OSS_QUERY_PARAM: filekey}, stream=True, verify=False,
                                headers=headers)  # stream=True 用于处理大文件

        logger.info(f"HTTP请求响应状态码: {response.status_code}")

        if response.status_code == 200:
            temp_audio_path = audio_path + ".tmp"
            logger.info(f"开始写入临时文件: {temp_audio_path}")

            total_size = 0
            try:
                with open(temp_audio_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            total_size += len(chunk)

                logger.info(f"下载完成，文件大小: {total_size} bytes，耗时: {time.time() - start_time:.2f}s")

                # 转换音频格式
                logger.info(f"开始转换音频格式为WAV: {temp_audio_path} -> {audio_path}")
                audio_segment = AudioSegment.from_file(temp_audio_path)
                audio_segment.export(audio_path, format="wav")
                logger.info("音频格式转换完成")
                logger.info(f"文件下载和转换成功完成: {audio_path}")
                return True
            except IndexError as e:
                logger.error(f"音频文件处理失败，可能是空音频文件: {e}")
                return False
            finally:
                # 清理临时文件
                if os.path.exists(temp_audio_path):
                    os.remove(temp_audio_path)
                    logger.info(f"清理临时文件: {temp_audio_path}")
        else:
            error_text = response.text
            logger.error(f"下载失败，状态码: {response.status_code}, 响应内容: {error_text}")
            raise Exception(f"下载失败，状态码: {response.status_code}")

    except requests.exceptions.RequestException as e:
        logger.error(f"下载请求异常: {e}")
        raise Exception(f"下载请求出错: {e}")
    except Exception as e:
        logger.error(f"下载过程中发生其他错误: {e}")
        raise Exception(f"下载发生其他错误: {e}")
