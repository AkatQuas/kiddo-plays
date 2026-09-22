import logging
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
import torch
from PIL import Image

from clip_embed.download import download_model

logger = logging.getLogger(__name__)


@dataclass
class ModelState:
    model: Any
    processor: Any
    device: str


_state: ModelState | None = None


def load_model() -> ModelState:
    """Load CLIP model and processor into memory."""
    global _state
    if _state is not None:
        return _state

    from transformers import CLIPModel, CLIPProcessor

    model_path = download_model()
    logger.info("Loading CLIP model from %s", model_path)
    start = time.time()

    model = CLIPModel.from_pretrained(str(model_path))
    processor = CLIPProcessor.from_pretrained(str(model_path))

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)

    elapsed = time.time() - start
    logger.info("Model loaded on %s in %.2f seconds", device, elapsed)

    _state = ModelState(model=model, processor=processor, device=device)
    return _state


def get_model_state() -> ModelState:
    if _state is None:
        load_model()
    return _state


def extract_features(image: Image.Image) -> np.ndarray:
    """Extract L2-normalized image features."""
    state = get_model_state()
    inputs = state.processor(images=image, return_tensors="pt")
    inputs = {k: v.to(state.device) for k, v in inputs.items()}

    with torch.no_grad():
        image_features = state.model.get_image_features(**inputs)

    # transformers 5.x returns BaseModelOutputWithPooling instead of a raw tensor
    if hasattr(image_features, "pooler_output"):
        image_features = image_features.pooler_output

    features_np = image_features.cpu().numpy()
    return features_np / np.linalg.norm(features_np, axis=1, keepdims=True)
