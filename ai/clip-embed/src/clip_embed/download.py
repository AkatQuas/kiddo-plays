import logging
import os
from pathlib import Path

from huggingface_hub import snapshot_download

from clip_embed.config import settings

logger = logging.getLogger(__name__)

# PyTorch inference only — skip flax/tf/pytorch duplicate weights (~5 GB saved)
INFERENCE_ALLOW_PATTERNS = [
    "model.safetensors",
    "config.json",
    "preprocessor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
    "merges.txt",
    "special_tokens_map.json",
]

REQUIRED_FILES = [
    "model.safetensors",
    "config.json",
    "preprocessor_config.json",
]


def _configure_hf_download() -> None:
    endpoint = settings.hf_endpoint or os.environ.get("HF_ENDPOINT")
    if endpoint:
        os.environ["HF_ENDPOINT"] = endpoint.rstrip("/")
        logger.info("Using HF_ENDPOINT=%s", os.environ["HF_ENDPOINT"])

    # Mirror sites don't proxy xethub CAS; large files fail with 401 without this.
    if os.environ.get("HF_HUB_DISABLE_XET") is None and endpoint:
        os.environ["HF_HUB_DISABLE_XET"] = "1"
        logger.info("HF_HUB_DISABLE_XET=1 (required for mirror downloads)")


def is_model_ready(model_path: Path) -> bool:
    weights = model_path / "model.safetensors"
    if not weights.exists() or weights.stat().st_size < 1_000_000_000:
        return False
    return all((model_path / name).exists() for name in REQUIRED_FILES if name != "model.safetensors")


def download_model() -> Path:
    """Download CLIP inference artifacts from Hugging Face Hub if not present locally."""
    _configure_hf_download()
    model_path = settings.resolved_model_path

    if is_model_ready(model_path):
        logger.info("Model already exists at %s, skipping download", model_path)
        return model_path

    logger.info(
        "Downloading inference files for %s to %s (~1.7 GB, weights only)",
        settings.model_id,
        model_path,
    )
    model_path.parent.mkdir(parents=True, exist_ok=True)

    snapshot_download(
        repo_id=settings.model_id,
        local_dir=str(model_path),
        allow_patterns=INFERENCE_ALLOW_PATTERNS,
    )
    logger.info("Model downloaded to %s", model_path)
    return model_path
