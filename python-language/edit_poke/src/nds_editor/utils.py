"""macOS 专属辅助工具：路径处理、编码转换"""
import os

from charset_normalizer import detect


def get_macos_rom_path(rom_name: str) -> str:
    """
    macOS 友好的ROM路径获取（优先桌面，适配中文/空格路径）
    :param rom_name: ROM文件名（如 "SoulSilver.nds"）
    :return: 完整路径
    """
    desktop = os.path.expanduser("~/Desktop")
    rom_path = os.path.join(desktop, rom_name)
    # macOS 路径转义，避免空格/中文问题
    return os.path.normpath(rom_path)

def convert_encoding(text: str, target_encoding: str = "shift_jis") -> bytes:
    """
    适配NDS日文ROM的编码转换（macOS默认UTF-8转Shift-JIS）
    :param text: 要转换的文本
    :param target_encoding: 目标编码（NDS常用shift_jis）
    :return: 编码后的字节流
    """
    try:
        return text.encode(target_encoding, errors="replace")
    except UnicodeEncodeError:
        print(f"编码错误：无法转换为 {target_encoding}，使用替换字符")
        return text.encode(target_encoding, errors="replace")

def detect_file_encoding(file_path: str) -> str:
    """
    检测提取的ROM文件编码（macOS下自动识别）
    :param file_path: 提取的文本/资源文件路径
    :return: 检测到的编码（如 shift_jis/utf-8）
    """
    with open(file_path, "rb") as f:
        raw_data = f.read()
    result = detect(raw_data)
    return result["encoding"] or "shift_jis"
