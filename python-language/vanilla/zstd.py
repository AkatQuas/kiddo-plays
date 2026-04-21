import os
import zstandard
import hashlib
import json
import shutil

# ====================== 配置 ======================
INPUT_DIR = "dist"          # 静态资源源目录
OUTPUT_DIR = "dist_zstd"    # 输出的 zstd 压缩目录
MANIFEST_FILE = "latest_manifest.json"
VERSION = "1.0.0"
# ==================================================

# 清空输出目录
if os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Zstd 压缩器
cctx = zstandard.ZstdCompressor(level=9)  # 最高压缩比

manifest = {
    "version": VERSION,
    "files": []
}

# 遍历目录
for root, dirs, files in os.walk(INPUT_DIR):
    for file in files:
        # 原始路径
        src_path = os.path.join(root, file)

        # 相对路径（保持目录结构）
        rel_path = os.path.relpath(src_path, INPUT_DIR)
        zst_path = rel_path + ".zst"

        # 输出路径
        dst_path = os.path.join(OUTPUT_DIR, zst_path)
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)

        # 读取文件
        with open(src_path, "rb") as f:
            data = f.read()

        # 原始文件哈希
        sha256_original = hashlib.sha256(data).hexdigest()

        # 压缩
        compressed = cctx.compress(data)

        # 写入 .zst
        with open(dst_path, "wb") as f:
            f.write(compressed)

        # 压缩后文件哈希
        sha256_zst = hashlib.sha256(compressed).hexdigest()
        size_raw = len(data)
        size_zst = len(compressed)

        # 加入清单
        manifest["files"].append({
            "path": rel_path.replace("\\", "/"),        # 客户端使用的路径
            "zstPath": zst_path.replace("\\", "/"),     # 下载路径
            "sha256": sha256_original,                   # 原始文件哈希
            "zstSha256": sha256_zst,                     # 压缩包哈希
            "size": size_raw,
            "zstSize": size_zst
        })

        print(f"✅ {rel_path} → {zst_path}")

# 保存清单
with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print("\n🎉 全部完成！")
print(f"📁 压缩目录：{OUTPUT_DIR}")
print(f"📄 增量更新清单：{MANIFEST_FILE}")
