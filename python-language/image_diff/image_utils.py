"""Utility functions for image loading, validation, comparison, and visualization."""

from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image, ImageChops

from exceptions import (ImageNotFoundError, ImageSizeMismatchError,
                        InvalidImageError)


def validate_and_load_image(path: str) -> Image.Image:
    """Load and validate a PNG image file.

    Args:
        path: Path to the image file

    Returns:
        Loaded PIL Image object in RGB mode

    Raises:
        ImageNotFoundError: If the file doesn't exist
        InvalidImageError: If the file is not a valid PNG
    """
    image_path = Path(path)

    # Check if file exists
    if not image_path.exists():
        raise ImageNotFoundError(f"Image file not found: {path}")

    # Try to load the image
    try:
        img = Image.open(image_path)

        # Verify it's a PNG
        if img.format != "PNG":
            raise InvalidImageError(f"File is not a PNG image: {path} (format: {img.format})")

        # Convert to RGB mode (handles RGBA, grayscale, etc.)
        img = img.convert("RGB")

        return img

    except (IOError, OSError) as e:
        raise InvalidImageError(f"Failed to load image {path}: {e}")


def validate_image_dimensions(img1: Image.Image, img2: Image.Image) -> None:
    """Validate that two images have matching dimensions.

    Args:
        img1: First image
        img2: Second image

    Raises:
        ImageSizeMismatchError: If dimensions don't match
    """
    if img1.size != img2.size:
        raise ImageSizeMismatchError(
            f"Image dimensions don't match: {img1.size} vs {img2.size}"
        )


def compare_images(img1: Image.Image, img2: Image.Image, threshold: int = 0) -> Tuple[Image.Image, dict]:
    """Compare two images pixel-by-pixel.

    Args:
        img1: First image
        img2: Second image
        threshold: Pixel difference threshold (0-255)

    Returns:
        Tuple of (difference_image, statistics_dict)
    """
    # Compute pixel-wise absolute difference
    diff = ImageChops.difference(img1, img2)

    # Convert to NumPy array for statistics
    diff_array = np.array(diff)
    img1_array = np.array(img1)
    img2_array = np.array(img2)

    # Calculate per-pixel difference magnitude (max across RGB channels)
    diff_magnitude = np.max(diff_array, axis=2)

    # Apply threshold
    different_pixels = np.sum(diff_magnitude > threshold)
    total_pixels = diff_magnitude.size
    identical_pixels = total_pixels - different_pixels

    # Calculate statistics
    stats = {
        "total_pixels": total_pixels,
        "different_pixels": different_pixels,
        "identical_pixels": identical_pixels,
        "difference_percentage": (different_pixels / total_pixels * 100) if total_pixels > 0 else 0,
        "max_difference": np.max(diff_magnitude),
        "mean_difference": np.mean(diff_magnitude)
    }

    return diff, stats


def visualize_highlight(diff: Image.Image, img1: Image.Image, threshold: int = 0, alpha: float = 0.2) -> Image.Image:
    """Create highlight visualization (semi-transparent red highlights on original).

    Args:
        diff: Difference image
        img1: Original first image
        threshold: Pixel difference threshold
        alpha: Opacity of the highlight (0.0 = transparent, 1.0 = opaque, default: 0.2)

    Returns:
        Visualization image
    """
    # Copy the original image
    result = img1.copy()
    result_array = np.array(result, dtype=np.float32)
    diff_array = np.array(diff)

    # Find pixels that differ (max across RGB channels)
    diff_magnitude = np.max(diff_array, axis=2)
    mask = diff_magnitude > threshold

    # Blend original pixels with semi-transparent red
    highlight_color = np.array([255, 0, 0], dtype=np.float32)
    result_array[mask] = (1 - alpha) * result_array[mask] + alpha * highlight_color

    return Image.fromarray(result_array.astype(np.uint8))


def visualize_grayscale(diff: Image.Image) -> Image.Image:
    """Create grayscale visualization (white = different, black = same).

    Args:
        diff: Difference image

    Returns:
        Visualization image
    """
    # Convert to grayscale
    diff_array = np.array(diff)

    # Calculate per-pixel difference magnitude
    diff_magnitude = np.max(diff_array, axis=2)

    # Enhance contrast by normalizing to full range
    if diff_magnitude.max() > 0:
        diff_magnitude = (diff_magnitude / diff_magnitude.max() * 255).astype(np.uint8)

    # Convert to RGB for consistency
    grayscale = np.stack([diff_magnitude] * 3, axis=2)

    return Image.fromarray(grayscale)


def print_statistics(stats: dict) -> None:
    """Print comparison statistics to stdout.

    Args:
        stats: Statistics dictionary from compare_images()
    """
    print("\nComparison Results:")
    print(f"  Total pixels: {stats['total_pixels']:,}")
    print(f"  Different pixels: {stats['different_pixels']:,}")
    print(f"  Identical pixels: {stats['identical_pixels']:,}")
    print(f"  Difference: {stats['difference_percentage']:.2f}%")
    print(f"  Max difference: {stats['max_difference']}")
    print(f"  Mean difference: {stats['mean_difference']:.2f}")
