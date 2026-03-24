"""Tests for the image comparison tool."""

from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from exceptions import (ImageNotFoundError, ImageSizeMismatchError,
                        InvalidImageError)
from image_utils import (compare_images, validate_and_load_image,
                         validate_image_dimensions, visualize_grayscale,
                         visualize_highlight)


@pytest.fixture
def temp_dir(tmp_path):
    """Provide a temporary directory for test files."""
    return tmp_path


@pytest.fixture
def identical_images(temp_dir):
    """Create two identical test images."""
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    path1 = temp_dir / "identical1.png"
    path2 = temp_dir / "identical2.png"
    img.save(path1)
    img.save(path2)
    return str(path1), str(path2)


@pytest.fixture
def different_images(temp_dir):
    """Create two different test images."""
    img1 = Image.new("RGB", (100, 100), color=(255, 0, 0))
    img2 = Image.new("RGB", (100, 100), color=(0, 0, 255))
    path1 = temp_dir / "different1.png"
    path2 = temp_dir / "different2.png"
    img1.save(path1)
    img2.save(path2)
    return str(path1), str(path2)


@pytest.fixture
def mismatched_size_images(temp_dir):
    """Create two images with different sizes."""
    img1 = Image.new("RGB", (100, 100), color=(255, 0, 0))
    img2 = Image.new("RGB", (200, 200), color=(0, 0, 255))
    path1 = temp_dir / "small.png"
    path2 = temp_dir / "large.png"
    img1.save(path1)
    img2.save(path2)
    return str(path1), str(path2)


@pytest.fixture
def partially_different_images(temp_dir):
    """Create two images with partial differences."""
    img1 = Image.new("RGB", (100, 100), color=(255, 0, 0))
    img2 = Image.new("RGB", (100, 100), color=(255, 0, 0))

    # Modify a small region in img2
    pixels = img2.load()
    for i in range(10, 20):
        for j in range(10, 20):
            pixels[i, j] = (0, 0, 255)

    path1 = temp_dir / "partial1.png"
    path2 = temp_dir / "partial2.png"
    img1.save(path1)
    img2.save(path2)
    return str(path1), str(path2)


class TestValidateAndLoadImage:
    """Tests for validate_and_load_image function."""

    def test_load_valid_png(self, identical_images):
        """Test loading a valid PNG file."""
        path1, _ = identical_images
        img = validate_and_load_image(path1)
        assert img is not None
        assert img.mode == "RGB"
        assert img.size == (100, 100)

    def test_nonexistent_file(self):
        """Test error when file doesn't exist."""
        with pytest.raises(ImageNotFoundError) as exc_info:
            validate_and_load_image("nonexistent.png")
        assert "not found" in str(exc_info.value).lower()

    def test_invalid_file(self, temp_dir):
        """Test error when file is not a valid image."""
        invalid_path = temp_dir / "invalid.png"
        invalid_path.write_text("not an image")

        with pytest.raises(InvalidImageError):
            validate_and_load_image(str(invalid_path))

    def test_non_png_image(self, temp_dir):
        """Test error when file is not a PNG."""
        # Create a JPEG file
        img = Image.new("RGB", (100, 100), color=(255, 0, 0))
        jpeg_path = temp_dir / "image.jpg"
        img.save(jpeg_path, "JPEG")

        # Rename to .png but it's still a JPEG
        fake_png = temp_dir / "fake.png"
        jpeg_path.rename(fake_png)

        with pytest.raises(InvalidImageError) as exc_info:
            validate_and_load_image(str(fake_png))
        assert "not a PNG" in str(exc_info.value)


class TestValidateImageDimensions:
    """Tests for validate_image_dimensions function."""

    def test_matching_dimensions(self, identical_images):
        """Test validation passes for matching dimensions."""
        path1, path2 = identical_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        # Should not raise an exception
        validate_image_dimensions(img1, img2)

    def test_mismatched_dimensions(self, mismatched_size_images):
        """Test error when dimensions don't match."""
        path1, path2 = mismatched_size_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        with pytest.raises(ImageSizeMismatchError) as exc_info:
            validate_image_dimensions(img1, img2)
        assert "(100, 100)" in str(exc_info.value)
        assert "(200, 200)" in str(exc_info.value)


class TestCompareImages:
    """Tests for compare_images function."""

    def test_identical_images(self, identical_images):
        """Test comparison of identical images."""
        path1, path2 = identical_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        diff, stats = compare_images(img1, img2)

        assert stats["total_pixels"] == 10000  # 100x100
        assert stats["different_pixels"] == 0
        assert stats["identical_pixels"] == 10000
        assert stats["difference_percentage"] == 0.0
        assert stats["max_difference"] == 0
        assert stats["mean_difference"] == 0.0

    def test_completely_different_images(self, different_images):
        """Test comparison of completely different images."""
        path1, path2 = different_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        diff, stats = compare_images(img1, img2)

        assert stats["total_pixels"] == 10000
        assert stats["different_pixels"] == 10000
        assert stats["identical_pixels"] == 0
        assert stats["difference_percentage"] == 100.0
        assert stats["max_difference"] == 255

    def test_partially_different_images(self, partially_different_images):
        """Test comparison of partially different images."""
        path1, path2 = partially_different_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        diff, stats = compare_images(img1, img2)

        assert stats["total_pixels"] == 10000
        assert stats["different_pixels"] == 100  # 10x10 region
        assert stats["identical_pixels"] == 9900
        assert stats["difference_percentage"] == 1.0

    def test_threshold_parameter(self, partially_different_images):
        """Test threshold parameter filters small differences."""
        path1, path2 = partially_different_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        # With threshold 0, all differences count
        diff, stats_no_threshold = compare_images(img1, img2, threshold=0)

        # With high threshold, differences might be ignored
        diff, stats_high_threshold = compare_images(img1, img2, threshold=254)

        assert stats_no_threshold["different_pixels"] >= stats_high_threshold["different_pixels"]


class TestVisualizationModes:
    """Tests for visualization functions."""

    def test_visualize_highlight(self, different_images):
        """Test highlight visualization mode."""
        path1, path2 = different_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        diff, _ = compare_images(img1, img2)
        result = visualize_highlight(diff, img1)

        assert result is not None
        assert result.size == img1.size
        assert result.mode == "RGB"

    def test_visualize_grayscale(self, different_images):
        """Test grayscale visualization mode."""
        path1, path2 = different_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        diff, _ = compare_images(img1, img2)
        result = visualize_grayscale(diff)

        assert result is not None
        assert result.size == img1.size
        assert result.mode == "RGB"

    def test_visualize_identical_images(self, identical_images):
        """Test visualization with identical images."""
        path1, path2 = identical_images
        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)

        diff, _ = compare_images(img1, img2)

        # All visualization modes should work with identical images
        highlight = visualize_highlight(diff, img1)
        grayscale = visualize_grayscale(diff)

        assert all([highlight, grayscale])


class TestEndToEnd:
    """End-to-end integration tests."""

    def test_full_workflow_identical(self, identical_images, temp_dir):
        """Test complete workflow with identical images."""
        path1, path2 = identical_images

        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)
        validate_image_dimensions(img1, img2)

        diff, stats = compare_images(img1, img2)
        result = visualize_highlight(diff, img1)

        output_path = temp_dir / "output.png"
        result.save(output_path)

        assert output_path.exists()
        assert stats["difference_percentage"] == 0.0

    def test_full_workflow_different(self, different_images, temp_dir):
        """Test complete workflow with different images."""
        path1, path2 = different_images

        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)
        validate_image_dimensions(img1, img2)

        diff, stats = compare_images(img1, img2)

        output_path = temp_dir / "output.png"

        assert output_path.exists()
        assert stats["difference_percentage"] == 100.0

    def test_all_visualization_modes(self, partially_different_images, temp_dir):
        """Test all visualization modes produce valid output."""
        path1, path2 = partially_different_images

        img1 = validate_and_load_image(path1)
        img2 = validate_and_load_image(path2)
        diff, _ = compare_images(img1, img2)

        modes = {
            "highlight": visualize_highlight(diff, img1),
            "grayscale": visualize_grayscale(diff),
        }

        for mode_name, result in modes.items():
            output_path = temp_dir / f"output_{mode_name}.png"
            result.save(output_path)
            assert output_path.exists(), f"Failed to save {mode_name} mode"
