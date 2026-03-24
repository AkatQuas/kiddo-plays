#!/usr/bin/env python3
"""PNG Image Comparison Tool

Compares two PNG images pixel-by-pixel and outputs a visualization of differences.
"""

import argparse
import sys

from exceptions import ImageComparisonError
from image_utils import (compare_images, print_statistics,
                         validate_and_load_image, validate_image_dimensions,
                         visualize_grayscale, visualize_highlight)


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Compare two PNG images pixel-by-pixel and visualize differences.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s image1.png image2.png
  %(prog)s image1.png image2.png -o custom.png
  %(prog)s image1.png image2.png -m grayscale
        """
    )

    parser.add_argument(
        "image1",
        type=str,
        help="Path to the first PNG image"
    )

    parser.add_argument(
        "image2",
        type=str,
        help="Path to the second PNG image"
    )

    parser.add_argument(
        "-o", "--output",
        type=str,
        default="diff_result.png",
        help="Output path for the difference image (default: diff_result.png)"
    )

    parser.add_argument(
        "-m", "--mode",
        type=str,
        choices=["highlight", "grayscale"],
        default="highlight",
        help="Visualization mode (default: highlight)"
    )

    parser.add_argument(
        "--threshold",
        type=int,
        default=0,
        metavar="N",
        help="Pixel difference threshold 0-255 (default: 0)"
    )

    args = parser.parse_args()

    # Validate threshold
    if not 0 <= args.threshold <= 255:
        parser.error("threshold must be between 0 and 255")

    return args


def main():
    """Main entry point for the image comparison tool."""
    try:
        # Parse arguments
        args = parse_arguments()

        # Load and validate images
        img1 = validate_and_load_image(args.image1)
        img2 = validate_and_load_image(args.image2)

        # Validate dimensions match
        validate_image_dimensions(img1, img2)

        # Compare images
        diff, stats = compare_images(img1, img2, args.threshold)

        # Print statistics
        print_statistics(stats)

        # Generate visualization based on mode
        if args.mode == "highlight":
            result = visualize_highlight(diff, img1, args.threshold)
        elif args.mode == "grayscale":
            result = visualize_grayscale(diff)
        else:
            raise ValueError(f"Unknown visualization mode: {args.mode}")

        # Save result
        result.save(args.output)
        print(f"\nDifference image saved to: {args.output}")

        return 0

    except ImageComparisonError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nOperation cancelled by user", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
