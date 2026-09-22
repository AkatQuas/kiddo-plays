import io
import zipfile

from clip_embed.zip_utils import extracted_zip_images, image_id_from_zip_path


def test_extracted_zip_images_finds_nested_files(tmp_path):
    archive_path = tmp_path / "images.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("a/photo.jpg", b"fake-image")
        archive.writestr("b/photo.jpg", b"fake-image-2")

    with extracted_zip_images(archive_path.read_bytes()) as (root, image_paths):
        ids = [image_id_from_zip_path(root, path) for path in image_paths]

    assert ids == ["a_photo", "b_photo"]
