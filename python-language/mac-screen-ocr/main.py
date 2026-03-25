#!/usr/bin/env python3
"""
Mac Screen OCR with RapidOCR and ONNX Runtime
Real-time screen capture and OCR processing
"""

import sys
import time
from typing import List, Tuple

import mss
import numpy as np
import pyperclip
from rapidocr import RapidOCR


class ScreenOCR:
    def __init__(self):
        """Initialize the OCR engine and screen capture"""
        self.ocr_engine = RapidOCR()
        self.sct = mss.mss()

    def capture_screen(self) -> np.ndarray:
        """
        Capture the main screen and return as numpy array
        Returns:
            numpy array of the screen capture
        """
        # Get the main monitor
        monitor = self.sct.monitors[1]  # Primary monitor
        screenshot = self.sct.grab(monitor)

        # Convert to numpy array
        img = np.array(screenshot)

        # Remove alpha channel if present (convert BGRA to BGR)
        if img.shape[2] == 4:
            img = img[:, :, :3]

        return img

    def process_ocr(self, img: np.ndarray) -> Tuple[List[str], List]:
        """
        Process OCR on the captured image
        Args:
            img: numpy array of the captured screen
        Returns:
            Tuple of (text_lines, full_results)
        """
        # Run OCR
        result, elapse = self.ocr_engine(img)

        # Process results
        text_lines = []
        if result:
            for line in result:
                # Extract text (first element of each line)
                text_lines.append(line[1])

        return text_lines, result

    def run_ocr_once(self) -> List[str]:
        """
        Capture screen once and run OCR
        Returns:
            List of detected text lines
        """
        # Capture screen
        img = self.capture_screen()

        # Process OCR
        text_lines, full_results = self.process_ocr(img)

        return text_lines

    def run_continuous_ocr(self, interval: float = 1.0):
        """
        Continuously capture screen and run OCR
        Args:
            interval: Time interval between captures in seconds
        """
        print("Starting continuous screen OCR...")
        print("Press Ctrl+C to stop")

        try:
            while True:
                # Capture and process
                text_lines = self.run_ocr_once()

                if text_lines:
                    print("\n--- Detected Text ---")
                    for i, line in enumerate(text_lines, 1):
                        print(f"[Line {i}] {line}")

                    # Copy to clipboard
                    full_text = "\n".join(text_lines)
                    pyperclip.copy(full_text)
                    print(f"\n[Text copied to clipboard] ({len(text_lines)} lines)")
                else:
                    print("No text detected")

                # Wait for next capture
                time.sleep(interval)

        except KeyboardInterrupt:
            print("\nOCR stopped by user")
        except Exception as e:
            print(f"Error during OCR: {e}")


def main():
    """Main function"""
    print("Mac Screen OCR - Real-time screen text extraction")
    print("=" * 50)

    # Initialize OCR
    ocr = ScreenOCR()

    # Check if we want continuous or single capture
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        interval = 10.0
        if len(sys.argv) > 2:
            try:
                interval = float(sys.argv[2])
            except ValueError:
                print("Invalid interval, using default 10.0 seconds")
        ocr.run_continuous_ocr(interval)
    else:
        # Single capture
        print("Capturing screen and running OCR...")
        text_lines = ocr.run_ocr_once()

        if text_lines:
            print("\n--- Detected Text ---")
            for i, line in enumerate(text_lines, 1):
                print(f"[Line {i}] {line}")

            # Copy to clipboard
            full_text = "\n".join(text_lines)
            pyperclip.copy(full_text)
            print(f"\n[Text copied to clipboard] ({len(text_lines)} lines)")
        else:
            print("No text detected")


if __name__ == "__main__":
    main()
