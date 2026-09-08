"""
外部测试语音管理API的测试脚本
参考 tests/test.py，实现对所有语音管理API的完整测试

测试功能：
1. 私有语音：创建、列表、获取、删除
2. 公共语音：创建、列表、获取、删除
"""

import argparse
import base64
import json
import os
import tempfile
import wave
from typing import Any

import numpy as np
import requests


def create_test_audio_file(duration_seconds=1, sample_rate=16000, output_path=None):
    """创建一个测试用的音频文件"""
    if output_path is None:
        output_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name

    # 生成简单的正弦波作为测试音频
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds))
    frequency = 440  # A4 音符
    audio_data = np.sin(2 * np.pi * frequency * t)

    # 转换为 16-bit PCM
    audio_data = (audio_data * 32767).astype(np.int16)

    # 保存为 WAV 文件
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)  # 单声道
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(audio_data.tobytes())

    return output_path


def encode_file_to_base64(file_path: str) -> str:
    """将文件编码为base64字符串"""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def download_file_from_url(url: str, output_path: str, timeout: int = 30):
    """从URL下载文件"""
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(response.content)
        return output_path
    except Exception as e:
        print(f"❌ 下载文件失败: {e}")
        return None


class VoiceManagerAPI:
    """语音管理API测试客户端"""

    def __init__(self, host="127.0.0.1", port=34011, user_id="test_user", admin_user="admin_user"):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        self.user_id = user_id
        self.admin_user = admin_user

    def create_voice(
        self, voice_name: str, audio_data: str, prompt_text: str, is_public: bool = False
    ) -> dict[str, Any] | None:
        """创建语音"""
        endpoint = "public/voices" if is_public else "voices"
        url = f"{self.base_url}/v1/{endpoint}"

        print(f"\n测试创建{endpoint}语音: {url}")
        print(
            f"参数: voice_name={voice_name}, audio_data_len={len(audio_data)}, prompt_text={prompt_text}"
        )

        headers = {
            "Content-Type": "application/json",
            "X-UID": self.admin_user if is_public else self.user_id,
        }
        data = {
            "voice_name": voice_name,
            "audio_data": audio_data,
            "audio_content": prompt_text,
        }

        try:
            response = requests.post(url, headers=headers, json=data)

            print(f"响应状态码: {response.status_code}")

            if response.status_code == 201:
                result = response.json()
                print("✅ 成功创建语音!")
                print(f"响应数据: {json.dumps(result, indent=2, ensure_ascii=False)}")
                return result
            else:
                print("❌ 请求失败")
                try:
                    error_detail = response.json()
                    print(f"错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
                except Exception:
                    print(f"错误信息: {response.text}")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ 网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ 发生错误: {e}")
            return None

    def get_voice(self, voice_id: str, is_public: bool = False) -> dict[str, Any] | None:
        """获取语音信息"""
        endpoint = "public/voices" if is_public else "voices"
        url = f"{self.base_url}/v1/{endpoint}/{voice_id}"

        print(f"\n测试获取{endpoint}语音: {url}")
        print(f"参数: voice_id={voice_id}")

        headers = {"X-UID": self.user_id}

        try:
            response = requests.get(url, headers=headers)

            print(f"响应状态码: {response.status_code}")

            if response.status_code == 200:
                result = response.json()
                print("✅ 成功获取语音信息!")
                print(f"响应数据: {json.dumps(result, indent=2, ensure_ascii=False)}")
                return result
            else:
                print("❌ 请求失败")
                try:
                    error_detail = response.json()
                    print(f"错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
                except Exception:
                    print(f"错误信息: {response.text}")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ 网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ 发生错误: {e}")
            return None

    def delete_voice(self, voice_id: str, is_public: bool = False) -> dict[str, Any] | None:
        """删除语音"""
        endpoint = "public/voices" if is_public else "voices"
        url = f"{self.base_url}/v1/{endpoint}/{voice_id}"

        print(f"\n测试删除{endpoint}语音: {url}")
        print(f"参数: voice_id={voice_id}")

        headers = {
            "X-UID": self.admin_user if is_public else self.user_id,
        }

        try:
            response = requests.delete(url, headers=headers)

            print(f"响应状态码: {response.status_code}")

            if response.status_code == 204:
                print("✅ 成功删除语音!")
                return {"voice_id": voice_id}
            else:
                print("❌ 请求失败")
                try:
                    error_detail = response.json()
                    print(f"错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
                except Exception:
                    print(f"错误信息: {response.text}")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ 网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ 发生错误: {e}")
            return None

    def list_voices(self, is_public: bool = False) -> list[dict[str, Any]] | None:
        """列出语音"""
        endpoint = "public/voices" if is_public else "voices"
        url = f"{self.base_url}/v1/{endpoint}"

        print(f"\n测试列出{endpoint}语音: {url}")

        headers = {"X-UID": self.user_id}

        try:
            response = requests.get(url, headers=headers)

            print(f"响应状态码: {response.status_code}")

            if response.status_code == 200:
                payload = response.json()
                result = payload.get("items", payload) if isinstance(payload, dict) else payload
                print("✅ 成功列出语音!")
                print(f"语音数量: {len(result) if isinstance(result, list) else 'N/A'}")
                print(f"响应数据: {json.dumps(payload, indent=2, ensure_ascii=False)}")
                return result
            else:
                print("❌ 请求失败")
                try:
                    error_detail = response.json()
                    print(f"错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
                except Exception:
                    print(f"错误信息: {response.text}")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ 网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ 发生错误: {e}")
            return None


def test_private_voice_workflow(api: VoiceManagerAPI, audio_data: str):
    """测试私有语音完整流程：创建 -> 获取 -> 列表 -> 删除"""
    print("\n" + "=" * 60)
    print("开始测试私有语音流程")
    print("=" * 60)

    voice_name = f"private_voice_{api.user_id}"
    prompt_text = "这是测试用的音色文本内容"

    # 1. 创建私有语音
    print("\n[步骤 1] 创建私有语音")
    create_result = api.create_voice(voice_name, audio_data, prompt_text, is_public=False)
    if not create_result:
        print("❌ 创建私有语音失败，终止测试")
        return None

    voice_id = create_result.get("id")
    if not voice_id:
        print("❌ 创建语音返回结果中未找到voice_id")
        return None

    # 2. 获取私有语音
    print("\n[步骤 2] 获取私有语音")
    get_result = api.get_voice(str(voice_id), is_public=False)
    if not get_result:
        print("❌ 获取私有语音失败")
        # 继续测试删除
    else:
        assert get_result.get("id") == voice_id, "获取的语音ID不匹配"
        assert get_result.get("voice_name") == voice_name, "获取的语音名称不匹配"
    tmp = api.user_id
    api.user_id = "9999"
    test_cross_user_access(api, str(voice_id))
    api.user_id = tmp
    # 3. 列出私有语音
    print("\n[步骤 3] 列出私有语音")
    list_result = api.list_voices(is_public=False)
    if not list_result:
        print("⚠️ 列出私有语音失败，但继续测试删除")
    else:
        found = any(voice.get("id") == voice_id for voice in list_result)
        assert found, "在列表中未找到刚创建的语音"

    # 4. 删除私有语音
    print("\n[步骤 4] 删除私有语音")
    delete_result = api.delete_voice(str(voice_id), is_public=False)
    if not delete_result:
        print("❌ 删除私有语音失败")
        return None

    print("\n" + "=" * 60)
    print("✅ 私有语音流程测试通过!")
    print("=" * 60)

    return voice_id


def test_public_voice_workflow(api: VoiceManagerAPI, audio_data: str):
    """测试公共语音完整流程：创建 -> 获取 -> 列表 -> 删除"""
    print("\n" + "=" * 60)
    print("开始测试公共语音流程")
    print("=" * 60)

    voice_name = f"public_voice_{api.admin_user}"
    prompt_text = "这是测试用的公共音色文本内容"

    # 1. 创建公共语音
    print("\n[步骤 1] 创建公共语音")
    create_result = api.create_voice(voice_name, audio_data, prompt_text, is_public=True)
    if not create_result:
        print("❌ 创建公共语音失败，终止测试")
        return None

    voice_id = create_result.get("id")
    if not voice_id:
        print("❌ 创建语音返回结果中未找到voice_id")
        return None

    # 2. 获取公共语音
    print("\n[步骤 2] 获取公共语音")
    get_result = api.get_voice(str(voice_id), is_public=True)
    if not get_result:
        print("❌ 获取公共语音失败")
        # 继续测试删除
    else:
        assert get_result.get("id") == voice_id, "获取的语音ID不匹配"
        assert get_result.get("voice_name") == voice_name, "获取的语音名称不匹配"
    tmp = api.user_id
    api.user_id = "9999"
    test_cross_user_access(api, str(voice_id))
    api.user_id = tmp

    # 3. 列出公共语音
    print("\n[步骤 3] 列出公共语音")
    list_result = api.list_voices(is_public=True)
    if not list_result:
        print("⚠️ 列出公共语音失败，但继续测试删除")
    else:
        found = any(voice.get("id") == voice_id for voice in list_result)
        assert found, "在列表中未找到刚创建的语音"

    # 4. 删除公共语音
    print("\n[步骤 4] 删除公共语音")
    delete_result = api.delete_voice(str(voice_id), is_public=True)
    if not delete_result:
        print("❌ 删除公共语音失败")
        return None

    print("\n" + "=" * 60)
    print("✅ 公共语音流程测试通过!")
    print("=" * 60)

    return voice_id


def test_cross_user_access(api: VoiceManagerAPI, voice_id: str):
    """测试跨用户访问权限（应该被拒绝）"""
    print("\n" + "=" * 60)
    print("开始测试跨用户访问权限")
    print("=" * 60)

    # 尝试用不同user_id访问私有语音（应该失败）
    print("\n[测试] 用普通用户访问公共语音（应该成功）========")
    print(f"api.user_id is {api.user_id}")
    get_result = api.get_voice(str(voice_id), is_public=True)
    if get_result:
        print("✅ 公共语音可以被其他用户访问")
    else:
        print("⚠️ 无法访问公共语音")

    print("\n" + "=" * 60)
    print("✅ 权限测试完成!")
    print("=" * 60)


def test_all_apis(api: VoiceManagerAPI, audio_data: str):
    """测试所有API功能"""
    print("\n" + "=" * 60)
    print("开始测试所有API功能")
    print("=" * 60)

    # 1. 测试私有语音流程
    test_private_voice_workflow(api, audio_data)

    # 2. 测试公共语音流程
    public_voice_id = test_public_voice_workflow(api, audio_data)

    # 3. 测试跨用户访问
    if public_voice_id:
        test_cross_user_access(api, public_voice_id)

    print("\n" + "=" * 60)
    print("🎉 所有测试完成!")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="测试语音管理 API")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="服务器地址")
    parser.add_argument("--port", type=int, default=34011, help="服务器端口")
    parser.add_argument("--user_id", type=str, default="test_user", help="普通用户ID")
    parser.add_argument(
        "--admin_user", type=str, default="0", help="白名单用户ID（仅公共语音需要）"
    )
    parser.add_argument(
        "--audio_file",
        type=str,
        default=None,
        help="本地音频文件路径（可选，不提供则自动创建临时音频）",
    )

    group = parser.add_mutually_exclusive_group()
    group.add_argument("--test_private", action="store_true", help="只测试私有语音")
    group.add_argument("--test_public", action="store_true", help="只测试公共语音")
    group.add_argument("--test_all", action="store_true", help="测试所有功能（默认）")

    args = parser.parse_args()

    print(f"服务器地址: http://{args.host}:{args.port}")
    print(f"普通用户ID: {args.user_id}")
    print(f"白名单用户ID: {args.admin_user}")

    cleanup_path = None
    if args.audio_file:
        audio_file = args.audio_file
        print(f"\n使用本地音频文件: {audio_file}")
    else:
        print("\n创建测试音频文件...")
        audio_file = create_test_audio_file(duration_seconds=12)
        cleanup_path = audio_file
        print(f"测试音频文件已创建: {audio_file}")

    audio_data = encode_file_to_base64(audio_file)
    print(f"✅ 音频已编码为 base64, len={len(audio_data)}")

    if cleanup_path:
        try:
            os.unlink(cleanup_path)
            print(f"已清理临时文件: {cleanup_path}")
        except OSError:
            pass

    api = VoiceManagerAPI(
        host=args.host, port=args.port, user_id=args.user_id, admin_user=args.admin_user
    )

    if args.test_private:
        test_private_voice_workflow(api, audio_data)
    elif args.test_public:
        test_public_voice_workflow(api, audio_data)
    else:
        test_all_apis(api, audio_data)


if __name__ == "__main__":
    main()
