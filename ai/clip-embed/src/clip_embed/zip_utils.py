import os
import tempfile
import zipfile
from contextlib import contextmanager
from pathlib import Path

VALID_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}


def find_image_paths(root: str) -> list[str]:
    image_files: list[str] = []
    for dirpath, _, files in os.walk(root):
        if "__MACOSX" in dirpath.split(os.sep):
            continue
        for name in files:
            if Path(name).suffix.lower() in VALID_IMAGE_EXT:
                image_files.append(os.path.join(dirpath, name))
    return sorted(image_files)


def image_id_from_zip_path(root: str, image_path: str) -> str:
    relative = os.path.relpath(image_path, root)
    return Path(relative).with_suffix("").as_posix().replace("/", "_")


@contextmanager
def extracted_zip_images(zip_bytes: bytes):
    if not zip_bytes:
        raise ValueError("empty ZIP file")

    with tempfile.TemporaryDirectory() as temp_dir:
        zip_path = os.path.join(temp_dir, "uploaded.zip")
        with open(zip_path, "wb") as handle:
            handle.write(zip_bytes)

        try:
            with zipfile.ZipFile(zip_path, "r") as archive:
                archive.extractall(temp_dir)
        except zipfile.BadZipFile as exc:
            raise ValueError(f"ZIP 解压失败: {exc}") from exc

        image_paths = find_image_paths(temp_dir)
        if not image_paths:
            raise ValueError("ZIP 中未找到有效图片")

        yield temp_dir, image_paths
