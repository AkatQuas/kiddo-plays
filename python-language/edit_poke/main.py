"""macOS NDS ROM编辑示例（以宝可梦魂银为例）"""
from src.nds_editor.core import NDSRomEditor


def main():
    # 1. 初始化编辑器（加载桌面的SoulSilver.nds）
    editor = NDSRomEditor("SoulSilver.nds")

    # print(editor.rom_path)
    # 2. 解包所有文件到桌面的nds_extracted目录
    editor.extract_all_files()

    # 3. 示例：替换ROM内的贴图文件（假设你修改了data/graphics/pokemon.bin）
    # editor.replace_file(
    #     rom_file_path="data/graphics/pokemon.bin",
    #     local_file_path="modified_pokemon.bin"  # 桌面的修改后文件
    # )

    # 4. 示例：修改文本（比如把"皮卡丘"改成"超梦"，需确保编码/长度匹配）
    # editor.edit_text(
    #     rom_text_path="data/text/msg_001.bin",
    #     old_text="皮卡丘",
    #     new_text="超梦"
    # )

    # 5. 保存修改后的ROM到桌面
    # editor.save_rom("SoulSilver_modded.nds")

if __name__ == "__main__":
    main()
