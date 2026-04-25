//! PNG validation functionality
//!
//! This module provides functions to validate PNG files by checking their signatures.

use std::fs::File;
use std::io::Read;

/// Validates if a file is a valid PNG by checking its signature
///
/// # Arguments
///
/// * `filepath` - Path to the file to validate
///
/// # Returns
///
/// * `true` if the file is a valid PNG, `false` otherwise
pub fn is_valid_png(filepath: &str) -> bool {
    // The PNG byte signature
    let expected_signature: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

    // Open the file and read first 8 bytes
    match File::open(filepath) {
        Ok(mut file) => {
            let mut signature: [u8; 8] = [0; 8];
            match file.read_exact(&mut signature) {
                Ok(()) => signature == expected_signature,
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_png() {
        // This would require a valid PNG file for testing
        // assert_eq!(is_valid_png("path/to/valid.png"), true);
    }

    #[test]
    fn test_invalid_png() {
        // This would require an invalid file for testing
        // assert_eq!(is_valid_png("path/to/invalid.txt"), false);
    }
}