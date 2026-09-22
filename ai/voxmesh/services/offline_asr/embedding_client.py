#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
说话人特征提取服务客户端
用于向特征提取服务器发送WAV文件并获取特征向量
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path
from typing import Dict, Optional

import requests


class EmbeddingClient:
    """特征提取服务客户端"""

    def __init__(self, server_host: str = "localhost", server_port: int = 36008):
        """
        初始化客户端

        Args:
            server_host: 服务器地址
            server_port: 服务器端口
        """
        self.server_url = f"http://{server_host}:{server_port}"
        self.extract_url = f"{self.server_url}/embedding_extract"

    def wav_file_to_base64(self, wav_file_path: str) -> Optional[str]:
        """
        将WAV文件转换为base64字符串

        Args:
            wav_file_path: WAV文件路径

        Returns:
            base64编码的字符串，失败返回None
        """
        try:
            if not os.path.exists(wav_file_path):
                print(f"❌ 文件不存在: {wav_file_path}")
                return None

            if not wav_file_path.lower().endswith('.wav'):
                print(f"❌ 文件格式错误，需要WAV格式: {wav_file_path}")
                return None

            with open(wav_file_path, 'rb') as f:
                wav_bytes = f.read()

            # 检查文件大小
            file_size = len(wav_bytes)
            print(f"📁 文件大小: {file_size / 1024:.2f} KB")

            if file_size == 0:
                print("❌ 文件为空")
                return None

            # 转换为base64
            print(f"🔄 开始转换文件为base64: {wav_file_path} size: {file_size}")
            base64_data = base64.b64encode(wav_bytes).decode('utf-8')
            print(f"✅ Base64转换成功，长度: {len(base64_data)}")

            return base64_data

        except Exception as e:
            print(f"❌ 文件读取失败: {e}")
            return None

    def extract_embedding(self, wav_file_path: str) -> Optional[Dict]:
        """
        提取特征向量

        Args:
            wav_file_path: WAV文件路径

        Returns:
            服务器响应数据，失败返回None
        """
        print(f"🎵 开始处理文件: {wav_file_path}")

        # 转换文件为base64
        base64_data = self.wav_file_to_base64(wav_file_path)
        if not base64_data:
            return None

        # 构造请求数据
        request_data = {
            "wav_data": base64_data
        }

        try:
            print("🚀 发送请求到服务器...")
            response = requests.post(
                self.extract_url,
                json=request_data,
                headers={"Content-Type": "application/json"},
                timeout=60  # 60秒超时
            )

            if response.status_code == 200:
                result = response.json()
                print("✅ 服务器响应成功")
                return result
            else:
                print(f"❌ 服务器错误: {response.status_code}")
                try:
                    error_info = response.json()
                    print(f"错误信息: {error_info}")
                except Exception:
                    print(f"响应内容: {response.text}")
                return None

        except requests.exceptions.Timeout:
            print("❌ 请求超时，服务器响应时间过长")
            return None
        except requests.exceptions.RequestException as e:
            print(f"❌ 请求失败: {e}")
            return None
        except json.JSONDecodeError:
            print("❌ 服务器响应格式错误")
            return None

    def save_results(self, wav_file_path: str, response_data: Dict) -> bool:
        """
        保存结果到文件

        Args:
            wav_file_path: 原WAV文件路径
            response_data: 服务器响应数据

        Returns:
            保存成功返回True
        """
        try:
            # 生成输出文件名
            wav_path = Path(wav_file_path)
            base_name = wav_path.stem

            # 保存完整响应
            response_file = f"{base_name}_response.json"
            with open(response_file, 'w', encoding='utf-8') as f:
                json.dump(response_data, f, ensure_ascii=False, indent=2)
            print(f"💾 完整响应已保存: {response_file}")

            # 如果提取成功，保存特征向量
            if response_data.get('code') == 0 and response_data.get('data'):
                data = response_data['data']

                # 保存base64格式的特征向量
                embedding_b64 = data.get('embedding', '')
                if embedding_b64:
                    embedding_file = f"{base_name}_embedding.txt"
                    with open(embedding_file, 'w', encoding='utf-8') as f:
                        f.write(embedding_b64)
                    print(f"🎯 特征向量已保存: {embedding_file}")

                # 打印信息
                print(f"📊 模型信息: {data.get('model_name', 'N/A')}")
                print(f"⏱️  音频时长: {data.get('wav_duration', 0):.2f} 秒")
                print(f"📏 特征维度: {len(embedding_b64)} (base64长度)")

            return True

        except Exception as e:
            print(f"❌ 保存结果失败: {e}")
            return False

    def process_wav_file(self, wav_file_path: str) -> bool:
        """
        处理单个WAV文件的完整流程

        Args:
            wav_file_path: WAV文件路径

        Returns:
            处理成功返回True
        """
        print("=" * 60)
        print(f"🎵 处理WAV文件: {wav_file_path}")
        print("=" * 60)

        # 提取特征
        response_data = self.extract_embedding(wav_file_path)
        if not response_data:
            return False

        # 检查响应状态
        code = response_data.get('code', -1)
        message = response_data.get('message', 'Unknown error')

        if code == 0:
            print(f"✅ 特征提取成功: {message}")
        else:
            print(f"❌ 特征提取失败 (代码: {code}): {message}")

        # 保存结果
        success = self.save_results(wav_file_path, response_data)

        if success and code == 0:
            print("🎉 处理完成！")
            return True
        else:
            return False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="说话人特征提取客户端")
    parser.add_argument(
        "--wav_file",
        type=str,
        help="要处理的WAV文件路径"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="localhost",
        help="服务器地址 (默认: localhost)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=36008,
        help="服务器端口 (默认: 36008)"
    )

    args = parser.parse_args()

    # 检查文件是否存在
    if not os.path.exists(args.wav_file):
        print(f"❌ 文件不存在: {args.wav_file}")
        sys.exit(1)

    # 创建客户端并处理文件
    client = EmbeddingClient(server_host=args.host, server_port=args.port)
    success = client.process_wav_file(args.wav_file)

    if success:
        print("\n🎉 所有操作完成！")
        sys.exit(0)
    else:
        print("\n❌ 操作失败！")
        sys.exit(1)


if __name__ == "__main__":
    main()
