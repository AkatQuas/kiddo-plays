#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import json
import ssl
import time
import wave
from pathlib import Path

import numpy as np
import websockets


class ASRWebSocketClient:
    """ASR WebSocket客户端"""

    def __init__(self, server_url="ws://localhost:36005", concurrent_connections=1, session_id=None):
        self.server_url = server_url
        self.concurrent_connections = concurrent_connections
        self.websockets = []  # 存储多个连接
        self.clients = []     # 存储多个客户端实例
        self.is_connected = False
        self.results = []
        self.session_id = session_id  # 用于会话恢复的session_id
        self.client_ids = {} # 存储服务器返回的client_id

        self.asr_params = {
            "hotword": [],
        }

    async def connect(self):
        """连接到WebSocket服务器（支持多路并发）"""
        try:
            print(f"正在建立 {self.concurrent_connections} 路连接到服务器: {self.server_url}")

            # 创建SSL上下文，跳过证书验证（用于自签名证书）
            ssl_context = None
            if self.server_url.startswith('wss://'):
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE

            # 创建多个并发连接
            connection_tasks = []
            for i in range(self.concurrent_connections):
                task = self._create_single_connection(i, ssl_context)
                connection_tasks.append(task)

            # 等待所有连接建立
            results = await asyncio.gather(*connection_tasks, return_exceptions=True)

            # 统计成功的连接
            successful_connections = 0
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    print(f"❌ 连接 {i+1} 失败: {result}")
                else:
                    successful_connections += 1

            if successful_connections > 0:
                self.is_connected = True
                print(f"✅ 成功建立 {successful_connections}/{self.concurrent_connections} 路连接")
                return True
            else:
                print("❌ 所有连接都失败了")
                return False

        except Exception as e:
            print(f"❌ 连接失败: {e}")
            return False

    async def _create_single_connection(self, connection_id, ssl_context):
        """创建单个连接"""
        try:
            websocket = await websockets.connect(
                self.server_url,
                ssl=ssl_context,
                ping_interval=30,
                ping_timeout=10,
                max_size=2 ** 22,  # 4MB
                # 添加请求头
                additional_headers={
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
                subprotocols=['binary']
            )

            # 保存连接
            self.websockets.append(websocket)

            # 发送初始化消息
            init_message = {
                "type": "init",
                "timestamp": time.time(),
                "params": self.asr_params
            }

            # 如果有session_id，添加到初始化消息中
            if self.session_id:
                init_message["session_id"] = self.session_id
                print(f"📤 连接 {connection_id+1} 尝试恢复会话: {self.session_id}")

            await websocket.send(json.dumps(init_message))
            print(f"📤 连接 {connection_id+1} 已发送初始化消息")

            return websocket

        except Exception as e:
            raise e

    async def disconnect(self):
        """断开所有连接"""
        if self.websockets:
            disconnect_tasks = []
            for websocket in self.websockets:
                if websocket:
                    try:
                        # 检查连接是否仍然打开
                        if not getattr(websocket, 'closed', True):
                            disconnect_tasks.append(websocket.close())
                    except AttributeError:
                        # 兼容不同版本的websockets库
                        disconnect_tasks.append(websocket.close())

            if disconnect_tasks:
                await asyncio.gather(*disconnect_tasks, return_exceptions=True)

            self.websockets.clear()
            self.is_connected = False
            print(f"🔌 已断开所有 {len(disconnect_tasks)} 路连接")

    async def handle_message(self, message, connection_id=0):
        """处理服务器消息"""
        try:
            data = json.loads(message)
            message_type = data.get('type', '')

            if message_type == 'welcome':
                print(f"🎉 连接 {connection_id + 1} 服务器欢迎消息: {data.get('message', '')}")

                # 保存服务器返回的client_id
                client_id = data.get('client_id')
                if client_id:
                    # 确保client_ids列表足够长
                    self.client_ids[connection_id] = client_id
                    print(f"📝 连接 {connection_id + 1} 获得client_id: {client_id}")

                # 检查会话恢复状态
                session_restored = data.get('session_restored', False)
                if session_restored:
                    restored_from = data.get('restored_from')
                    print(f"🔄 连接 {connection_id + 1} 会话已恢复，原会话ID: {restored_from}")
                elif self.session_id:
                    print(f"⚠️ 连接 {connection_id + 1} 会话恢复失败，使用新会话")
                if 'version' in data:
                    print(f"📋 连接 {connection_id + 1} 服务器确认的版本: {data['version']}")
                if 'params' in data:
                    print(f"📋 连接 {connection_id + 1} 服务器确认的参数: {data['params']}")

            elif message_type == 'recognition_result':
                results = data.get('results', [])
                for result in results:
                    self.handle_recognition_result(result, connection_id)

            elif message_type == 'advice':
                print(f"🤖 连接 {connection_id + 1} AI建议: {data.get('title', '')} - {data.get('prompt', '')}")

            elif message_type == 'error':
                print(f"❌ 连接 {connection_id + 1} 服务器错误: {data.get('message', '')}")

            elif message_type == 'init_ack':
                print(f"✅ 连接 {connection_id + 1} 初始化确认: {data.get('message', '')}")

            elif message_type == 'volume_warning':
                print(f"🔉 音量警告: {data.get('message', '')}")
                volume_data = {
                    'rms_db': data.get('rms_db', 0),
                    'peak_db': data.get('peak_db', 0),
                    'duration_s': data.get('duration_s', 0),
                    'detection_time_ms': data.get('detection_time_ms', 0)
                }
                print(f"   📊 音量详情: RMS={volume_data['rms_db']:.1f}dB, Peak={volume_data['peak_db']:.1f}dB, 时长={volume_data['duration_s']:.1f}s")
                print(f"   ⏱️  检测耗时: {volume_data['detection_time_ms']:.2f}ms")
                print(f"🔍 调试 - 完整音量警告数据: {data}")

            else:
                print(f"📨 连接 {connection_id + 1} 未知消息类型 {message_type}: {data}")

        except json.JSONDecodeError as e:
            print(f"❌ JSON解析错误: {e}")
        except Exception as e:
            print(f"❌ 处理消息错误: {e}")

    def handle_recognition_result(self, result, connection_id=0):
        """处理识别结果"""
        result_type = result.get('type', 'unknown')
        result_text = result.get('text', '')
        result_ts = result.get('ts', 0)
        result_latency = result.get('latency', 0)
        result_speaker = result.get('current_speaker', '')
        speaker_distance = result.get('speaker_distance')

        # 生成状态标识
        type_indicator = {
            'begin': '🟡 开始',
            'changed': '🔄 识别中',
            'end': '🟢 完成',
            'advice': '🤖 建议'
        }.get(result_type, '❓ ' + result_type)

        # 构建输出信息
        info_parts = [f"时间:{result_ts:.2f}s", f"延迟:{result_latency*1000:.0f}ms"]
        if result_speaker:
            info_parts.append(f"说话人:{result_speaker}")
            if speaker_distance is not None:
                info_parts.append(f"距离:{speaker_distance:.3f}")

        info_str = " | ".join(info_parts)

        print(f"{type_indicator} [连接{connection_id + 1} | {info_str}] {result_text}")

        # 保存结果，添加连接标识
        result_with_connection = result.copy()
        result_with_connection['connection_id'] = connection_id
        self.results.append(result_with_connection)

    def load_wav_file(self, wav_path):
        """加载WAV文件并转换为16kHz单声道PCM数据"""
        wav_path = Path(wav_path)
        if not wav_path.exists():
            raise FileNotFoundError(f"音频文件不存在: {wav_path}")

        print(f"📁 正在加载音频文件: {wav_path}")

        # 读取WAV文件
        with wave.open(str(wav_path), 'rb') as wav_file:
            # 获取音频参数
            frames = wav_file.getnframes()
            sample_rate = wav_file.getframerate()
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            duration = frames / sample_rate

            print(f"📊 音频信息: {duration:.2f}s, {sample_rate}Hz, {channels}声道, {sample_width*8}bit")

            # 读取音频数据
            audio_data = wav_file.readframes(frames)

        # 转换为numpy数组
        if sample_width == 1:
            audio_array = np.frombuffer(audio_data, dtype=np.uint8)
            audio_array = (audio_array.astype(np.float32) - 128) / 128.0
        elif sample_width == 2:
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            audio_array = audio_array.astype(np.float32) / 32768.0
        elif sample_width == 4:
            audio_array = np.frombuffer(audio_data, dtype=np.int32)
            audio_array = audio_array.astype(np.float32) / 2147483648.0
        else:
            raise ValueError(f"不支持的采样位数: {sample_width * 8}")

        # 处理多声道数据（转为单声道）
        if channels > 1:
            audio_array = audio_array.reshape(-1, channels)
            audio_array = np.mean(audio_array, axis=1)

        # 重采样到16kHz（简单的线性插值）
        target_sample_rate = 16000
        if sample_rate != target_sample_rate:
            print(f"🔄 重采样: {sample_rate}Hz -> {target_sample_rate}Hz")
            resample_ratio = target_sample_rate / sample_rate
            new_length = int(len(audio_array) * resample_ratio)

            # 使用numpy的插值函数进行重采样
            old_indices = np.linspace(0, len(audio_array) - 1, len(audio_array))
            new_indices = np.linspace(0, len(audio_array) - 1, new_length)
            audio_array = np.interp(new_indices, old_indices, audio_array)

            sample_rate = target_sample_rate
            duration = len(audio_array) / sample_rate
            print(f"📊 重采样后: {duration:.2f}s, {sample_rate}Hz")

        return audio_array, sample_rate, duration

    async def send_audio_file(self, wav_path, chunk_duration_ms=60):
        """发送音频文件数据到所有连接"""
        if not self.is_connected:
            print("❌ 请先连接到服务器")
            return False

        try:
            # 加载音频文件
            audio_data, sample_rate, total_duration = self.load_wav_file(wav_path)

            # 计算分块参数
            samples_per_chunk = int(sample_rate * chunk_duration_ms / 1000)
            total_samples = len(audio_data)
            total_chunks = (total_samples + samples_per_chunk - 1) // samples_per_chunk

            print(f"🚀 开始向 {len(self.websockets)} 路连接发送音频数据:")
            print(f"   📦 分块大小: {samples_per_chunk} 样本 ({chunk_duration_ms}ms)")
            print(f"   📊 总块数: {total_chunks}")
            print(f"   ⏱️  预计耗时: {total_duration:.2f}s")
            print()

            # 清空之前的结果
            self.results = []

            # 创建并发发送任务
            send_tasks = []
            for connection_id, websocket in enumerate(self.websockets):
                if websocket:
                    # 简化逻辑：如果websocket对象存在，就创建发送任务
                    # 如果连接已关闭，发送时会自然抛出异常被处理
                    task = self._send_audio_to_connection(
                        websocket, connection_id, audio_data,
                        samples_per_chunk, total_chunks, chunk_duration_ms
                    )
                    send_tasks.append(task)

            if not send_tasks:
                print("❌ 没有可用的连接")
                return False

            # 等待所有发送任务完成
            results = await asyncio.gather(*send_tasks, return_exceptions=True)

            # 统计发送结果
            successful_sends = sum(1 for result in results if not isinstance(result, Exception))
            print(f"\n✅ 音频数据发送完成: {successful_sends}/{len(send_tasks)} 路连接发送成功")

            return successful_sends > 0

        except Exception as e:
            print(f"❌ 发送音频失败: {e}")
            return False

    async def _send_audio_to_connection(self, websocket, connection_id, audio_data,
                                      samples_per_chunk, total_chunks, chunk_duration_ms):
        """向单个连接发送音频数据"""
        try:
            sample_rate = 16000  # 固定采样率
            for i in range(total_chunks):
                start_idx = i * samples_per_chunk
                end_idx = min(start_idx + samples_per_chunk, len(audio_data))
                chunk = audio_data[start_idx:end_idx]

                # 转换为16位PCM格式
                chunk_int16 = (chunk * 32767).astype(np.int16)
                chunk_bytes = chunk_int16.tobytes()

                # 发送数据块
                await websocket.send(chunk_bytes)

                # 每隔5路连接显示一次进度，避免输出混乱
                if connection_id % 5 == 0:
                    progress = (i + 1) / total_chunks * 100
                    current_time = end_idx / sample_rate
                    total_duration = len(audio_data) / sample_rate
                    print(f"\r📤 连接{connection_id + 1} 发送进度: {progress:.1f}% ({i+1}/{total_chunks}) - {current_time:.2f}s/{total_duration:.2f}s", end='', flush=True)

                # 按实际时间间隔发送（模拟实时音频流）
                await asyncio.sleep(chunk_duration_ms / 1000)

            if connection_id % 5 == 0:
                print(f"\n✅ 连接 {connection_id + 1} 音频数据发送完成")

            return True

        except Exception as e:
            print(f"❌ 连接 {connection_id + 1} 发送音频失败: {e}")
            return False

    async def listen_for_messages(self):
        """监听所有连接的服务器消息"""
        if not self.websockets:
            print("❌ 没有可用的连接")
            return

        # 为每个连接创建监听任务
        listen_tasks = []
        for connection_id, websocket in enumerate(self.websockets):
            if websocket:
                # 简化逻辑：如果websocket对象存在，就创建监听任务
                task = self._listen_single_connection(websocket, connection_id)
                listen_tasks.append(task)

        if listen_tasks:
            # 等待任意一个连接关闭或出错
            try:
                await asyncio.gather(*listen_tasks, return_exceptions=True)
            except Exception as e:
                print(f"❌ 监听消息时出错: {e}")

    async def _listen_single_connection(self, websocket, connection_id):
        """监听单个连接的消息"""
        try:
            async for message in websocket:
                await self.handle_message(message, connection_id)
        except websockets.exceptions.ConnectionClosed:
            print(f"🔌 连接 {connection_id + 1} 已关闭")
        except Exception as e:
            print(f"❌ 连接 {connection_id + 1} 监听消息时出错: {e}")

    def get_client_ids(self):
        """获取所有连接的client_id列表"""
        return list(self.client_ids.values())

    def print_session_info(self):
        """打印会话信息"""
        client_ids = self.get_client_ids()
        if client_ids:
            print("\n📋 会话信息:")
            print(f"   服务器地址: {self.server_url}")
            print(f"   连接数: {len(client_ids)}")
            print(f"   Client IDs: {', '.join(client_ids)}")
            if len(client_ids) == 1:
                print(f"   💡 下次重连可使用: --session_id {client_ids[0]}")
            print()

    def print_final_results(self):
        """打印最终识别结果摘要"""
        if not self.results:
            print("\n📝 没有收到识别结果")
            return

        print(f"\n📋 识别结果摘要 (共{len(self.results)}条):")
        print("=" * 60)

        final_results = [r for r in self.results if r.get('type') == 'end']
        if final_results:
            print("🎯 最终识别结果:")
            for i, result in enumerate(final_results, 1):
                text = result.get('text', '')
                ts = result.get('ts', 0)
                speaker = result.get('current_speaker', '')
                speaker_info = f" (说话人: {speaker})" if speaker else ""
                print(f"   {i}. [{ts:.2f}s]{speaker_info} {text}")

        # 合并所有最终结果的文本
        all_text = " ".join([r.get('text', '') for r in final_results if r.get('text')])
        if all_text:
            print("\n📄 完整识别文本:")
            print(f"   {all_text}")

        # 打印会话信息
        self.print_session_info()

async def main():
    """主函数"""
    import sys

    # 检查命令行参数
    if len(sys.argv) < 2:
        print("使用方法: python client.py <音频文件路径> [服务器地址] [并发连接数] [--session_id <会话ID>]")
        print("示例: python client.py long.wav")
        print("示例: python client.py long.wav ws://localhost:36005")
        print("示例: python client.py long.wav ws://localhost:36005 10")
        print("示例: python client.py long.wav ws://localhost:36005 1 --session_id my-session-id")
        return

    wav_file = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "ws://localhost:36005"
    concurrent_connections = 1
    session_id = None

    # 解析剩余参数
    i = 3
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--session_id' and i + 1 < len(sys.argv):
            session_id = sys.argv[i + 1]
            i += 2
        elif arg.isdigit():
            concurrent_connections = int(arg)
            i += 1
        else:
            i += 1

    # 检查文件是否存在
    if not Path(wav_file).exists():
        print(f"❌ 音频文件不存在: {wav_file}")
        return

    # 验证并发连接数
    if concurrent_connections > 10:
        print(f"⚠️  警告: 请求 {concurrent_connections} 路连接，建议先从较少连接数开始测试")
        response = input("是否继续? (y/N): ")
        if response.lower() not in ['y', 'yes']:
            print("已取消")
            return

    # 创建客户端
    client = ASRWebSocketClient(server_url, concurrent_connections, session_id)

    if session_id:
        print(f"🔄 尝试恢复会话: {session_id}")

    try:
        # 连接到服务器
        if not await client.connect():
            return

        # 创建消息监听任务
        listen_task = asyncio.create_task(client.listen_for_messages())

        # 等待一秒让初始化完成
        await asyncio.sleep(1)

        # 发送音频文件
        success = await client.send_audio_file(wav_file)

        if success:
            # 等待更多结果
            await asyncio.sleep(3)

        # 取消监听任务
        listen_task.cancel()

        # 打印最终结果
        client.print_final_results()

    except KeyboardInterrupt:
        print("\n⏹️  用户中断")
    except Exception as e:
        print(f"❌ 运行时错误: {e}")
    finally:
        # 断开连接
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
