import json
import logging
import os
import time

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from PIL import Image
from tqdm import tqdm

from clip_embed.gallery import get_gallery_store
from clip_embed.image_io import read_upload_image
from clip_embed.model import extract_features
from clip_embed.zip_utils import extracted_zip_images, image_id_from_zip_path

logger = logging.getLogger(__name__)
router = APIRouter(tags=["search"])


@router.post("/gallery/images/")
async def add_gallery_image(
    file: UploadFile = File(...),
    image_id: str | None = Form(None),
    metadata: str | None = Form(None),
):
    """Add an image to the searchable gallery."""
    start = time.time()
    try:
        parsed_metadata = json.loads(metadata) if metadata else {}
        if not isinstance(parsed_metadata, dict):
            raise ValueError("metadata must be a JSON object")

        image = await read_upload_image(file)
        embedding = extract_features(image)
        item = get_gallery_store().add(
            filename=file.filename or "unknown",
            embedding=embedding,
            image_id=image_id,
            metadata=parsed_metadata,
        )
        return {
            "id": item.id,
            "filename": item.filename,
            "metadata": item.metadata,
            "processing_time_sec": round(time.time() - start, 3),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"处理失败: {e}") from e


@router.post("/gallery/images/batch/")
async def add_gallery_images_batch(
    file: UploadFile = File(...),
    metadata: str | None = Form(None),
):
    """Add all images from a ZIP archive to the searchable gallery."""
    start_time = time.time()

    if file.content_type not in ("application/zip", "application/x-zip-compressed"):
        raise HTTPException(status_code=400, detail="仅支持 ZIP 压缩包")

    try:
        parsed_metadata = json.loads(metadata) if metadata else {}
        if not isinstance(parsed_metadata, dict):
            raise ValueError("metadata must be a JSON object")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"metadata JSON 无效: {e}") from e

    contents = await file.read()
    store = get_gallery_store()
    results: dict[str, dict] = {}

    try:
        with extracted_zip_images(contents) as (temp_dir, image_files):
            logger.info("Batch importing %d images to gallery", len(image_files))
            total_start = time.time()

            for img_path in tqdm(image_files, desc="Gallery import"):
                filename = os.path.basename(img_path)
                image_id = image_id_from_zip_path(temp_dir, img_path)
                try:
                    image_start = time.time()
                    image = Image.open(img_path).convert("RGB")
                    embedding = extract_features(image)
                    item = store.add(
                        filename=filename,
                        embedding=embedding,
                        image_id=image_id,
                        metadata=parsed_metadata,
                    )
                    results[filename] = {
                        "status": "success",
                        "id": item.id,
                        "processing_time_sec": round(time.time() - image_start, 3),
                    }
                except ValueError as e:
                    results[filename] = {"status": "error", "id": image_id, "error": str(e)}
                except Exception as e:
                    results[filename] = {"status": "error", "id": image_id, "error": str(e)}

            succeeded = sum(1 for item in results.values() if item["status"] == "success")
            return {
                "total_images": len(image_files),
                "succeeded": succeeded,
                "failed": len(image_files) - succeeded,
                "gallery_size": len(store.list_items()),
                "total_processing_time_sec": round(time.time() - total_start, 2),
                "total_request_time_sec": round(time.time() - start_time, 2),
                "results": results,
            }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/gallery/images/")
async def list_gallery_images():
    """List all images in the gallery."""
    items = get_gallery_store().list_items()
    return {
        "total": len(items),
        "items": [
            {
                "id": item.id,
                "filename": item.filename,
                "metadata": item.metadata,
                "added_at": item.added_at,
            }
            for item in items
        ],
    }


@router.delete("/gallery/images/{image_id}")
async def delete_gallery_image(image_id: str):
    """Remove an image from the gallery."""
    try:
        removed = get_gallery_store().remove(image_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"image not found: {image_id}") from None

    return {"id": removed.id, "filename": removed.filename, "status": "deleted"}


@router.post("/image-search/")
async def search_by_image(
    file: UploadFile = File(...),
    top_k: int = Query(5, ge=1, le=100),
):
    """Search the gallery for images most similar to the query image."""
    start = time.time()
    try:
        image = await read_upload_image(file)
        query_embedding = extract_features(image)
        matches = get_gallery_store().search(query_embedding, top_k=top_k)
        return {
            "query_filename": file.filename,
            "top_k": top_k,
            "gallery_size": len(get_gallery_store().list_items()),
            "processing_time_sec": round(time.time() - start, 3),
            "matches": matches,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"处理失败: {e}") from e
