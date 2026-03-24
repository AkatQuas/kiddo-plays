"""Custom exceptions for image comparison operations."""


class ImageComparisonError(Exception):
    """Base exception for image comparison errors."""
    pass


class ImageNotFoundError(ImageComparisonError):
    """Raised when an image file doesn't exist."""
    pass


class InvalidImageError(ImageComparisonError):
    """Raised when a file is not a valid PNG image."""
    pass


class ImageSizeMismatchError(ImageComparisonError):
    """Raised when image dimensions don't match."""
    pass
