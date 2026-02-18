"""NDS ROM编辑核心功能：解包、替换、打包"""
import os

import ndspy.rom

from .utils import convert_encoding, get_macos_rom_path


class NDSRomEditor:
    rom_path: str
    rom: ndspy.rom.NintendoDSRom | None
    def __init__(self, rom_name: str):
        """
        初始化编辑器（macOS桌面优先加载ROM）
        :param rom_name: ROM文件名（如 "SoulSilver.nds"）
        """
        self.rom_path = get_macos_rom_path(rom_name)
        self.rom = None
        self.load_rom()

    def load_rom(self) -> None:
        """加载NDS ROM（macOS权限适配）"""
        try:
            self.rom = ndspy.rom.NintendoDSRom.fromFile(self.rom_path)
            print(f"✅ 成功加载ROM: {self.rom_path}")
            print(f"📄 ROM包含 {len(self.rom.files)} 个文件")
        except FileNotFoundError:
            raise FileNotFoundError(f"❌ ROM文件不存在：{self.rom_path}\n请确认文件放在macOS桌面，且文件名正确")
        except PermissionError:
            raise PermissionError(f"❌ macOS权限不足：请给 {self.rom_path} 读取权限")

    def extract_all_files(self, output_dir: str = "nds_extracted") -> None:
        """
        解包ROM所有文件到指定目录（macOS路径适配）
        :param output_dir: 输出目录（默认当前目录下nds_extracted）
        """
        if self.rom is None:
            raise RuntimeError(
                "❌ ROM未成功加载，无法解包文件！\n"
                "请检查：1. ROM文件路径是否正确 2. 文件是否有权限读取 3. ROM文件是否损坏"
            )

        output_dir = get_macos_rom_path(output_dir)  # 输出到桌面，方便查看
        os.makedirs(output_dir, exist_ok=True)

        for i, file_data in enumerate(self.rom.files):
            file_name = self.rom.filenames.filenameOf(i)
            print(file_name)
            if file_name is None:
                file_name = f"file_{i}.bin"
            # macOS 处理特殊字符路径
            file_path = os.path.join(output_dir, file_name.lstrip("/"))
            file_dir = os.path.dirname(file_path)
            os.makedirs(file_dir, exist_ok=True)

            with open(file_path, "wb") as f:
                f.write(file_data)
        print(f"✅ 解包完成：文件保存到 {output_dir}")

    def replace_file(self, rom_file_path: str, local_file_path: str) -> None:
        """
        替换ROM内的指定文件（比如修改后的贴图/文本）
        :param rom_file_path: ROM内的文件路径（如 "data/text/msg.bin"）
        :param local_file_path: 本地修改后的文件路径（macOS路径）
        """
        if self.rom is None:
            raise RuntimeError(
                "❌ ROM未成功加载，无法解包文件！\n"
                "请检查：1. ROM文件路径是否正确 2. 文件是否有权限读取 3. ROM文件是否损坏"
            )

        local_file_path = get_macos_rom_path(os.path.basename(local_file_path))
        try:
            with open(local_file_path, "rb") as f:
                new_data = f.read()
            # 替换ROM文件
            self.rom.setFileByName(rom_file_path, new_data)
            print(f"✅ 成功替换ROM文件：{rom_file_path}")
        except Exception as e:
            raise ValueError(f"❌ 替换文件失败：{e}")

    def save_rom(self, output_name: str = "modded_rom.nds") -> None:
        """
        保存修改后的ROM到macOS桌面
        :param output_name: 输出文件名
        """
        if self.rom is None:
            raise RuntimeError(
                "❌ ROM未成功加载，无法解包文件！\n"
                "请检查：1. ROM文件路径是否正确 2. 文件是否有权限读取 3. ROM文件是否损坏"
            )

        output_path = get_macos_rom_path(output_name)
        self.rom.saveToFile(output_path)
        print(f"✅ 修改后的ROM已保存：{output_path}")

    def edit_text(self, rom_text_path: str, old_text: str, new_text: str) -> None:
        """
        编辑ROM内的文本（适配NDS日文编码，macOS专用）
        :param rom_text_path: ROM内文本文件路径
        :param old_text: 原文本
        :param new_text: 新文本
        """
        if self.rom is None:
            raise RuntimeError(
                "❌ ROM未成功加载，无法解包文件！\n"
                "请检查：1. ROM文件路径是否正确 2. 文件是否有权限读取 3. ROM文件是否损坏"
            )

        # 读取原文件
        text_data = self.rom.getFileByName(rom_text_path)
        # 编码转换（macOS UTF-8 → NDS Shift-JIS）
        old_bytes = convert_encoding(old_text)
        new_bytes = convert_encoding(new_text)

        # 替换文本（保持长度一致，避免ROM崩溃）
        if len(new_bytes) > len(old_bytes):
            raise ValueError(f"❌ 新文本过长：原长度 {len(old_bytes)}，新长度 {len(new_bytes)}")
        # 补零填充，保持长度一致
        new_bytes = new_bytes.ljust(len(old_bytes), b"\x00")

        modified_data = text_data.replace(old_bytes, new_bytes)
        self.rom.setFileByName(rom_text_path, modified_data)
        print(f"✅ 文本修改完成：{old_text} → {new_text}")
