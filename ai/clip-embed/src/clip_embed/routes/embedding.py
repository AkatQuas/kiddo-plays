import logging
import os
import time

from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image
from tqdm import tqdm

from clip_embed.image_io import read_upload_image
from clip_embed.model import extract_features
from clip_embed.zip_utils import extracted_zip_images

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/image-embedding/")
async def get_image_features(file: UploadFile = File(...)):
    """Process a single image and return its embedding vector."""
    start = time.time()
    try:
        image = await read_upload_image(file)
        features = extract_features(image)
        elapsed = time.time() - start
        return {
            "filename": file.filename,
            "processing_time_sec": round(elapsed, 3),
            "image_embedding": features.flatten().tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"处理失败: {e}") from e


@router.post("/batch-image-embeddings/")
async def get_batch_image_features(file: UploadFile = File(...)):
    """Accept a ZIP archive and return embeddings for all images inside."""
    start_time = time.time()
    logger.info("Start processing batch request")

    if file.content_type not in ("application/zip", "application/x-zip-compressed"):
        raise HTTPException(status_code=400, detail="仅支持 ZIP 压缩包")

    contents = await file.read()

    try:
        with extracted_zip_images(contents) as (_, image_files):
            logger.info("Processing %d images", len(image_files))
            results: dict[str, dict] = {}
            total_start = time.time()

            for img_path in tqdm(image_files, desc="Processing"):
                filename = os.path.basename(img_path)
                try:
                    image_start = time.time()
                    image = Image.open(img_path).convert("RGB")
                    features = extract_features(image)
                    elapsed = time.time() - image_start
                    results[filename] = {
                        "status": "success",
                        "processing_time_sec": round(elapsed, 3),
                        "image_embedding": features.flatten().tolist(),
                    }
                except Exception as e:
                    results[filename] = {"status": "error", "error": str(e)}

            total_time = time.time() - total_start
            logger.info("Batch processing completed in %.2f seconds", total_time)

            return {
                "total_images": len(image_files),
                "total_processing_time_sec": round(total_time, 2),
                "total_request_time_sec": round(time.time() - start_time, 2),
                "results": results,
            }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
