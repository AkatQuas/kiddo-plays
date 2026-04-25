//! Image optimization functionality
//!
//! This module provides functions to optimize PNG files using pngquant and zopflipng.

use std::process::Command;
use std::path::Path;
use std::fs;

/// Error types for the optimizer
#[derive(Debug, thiserror::Error)]
pub enum OptimizerError {
    #[error("PNG validation failed for file: {0}")]
    InvalidPng(String),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Process exited with code {code}: {message}")]
    ProcessExitError { code: i32, message:  String },
    #[error("File operation failed: {0}")]
    FileOperationError(String),
}

/// Image file representation
pub struct ImageFile {
    pub pre_filepath: String,
    pub post_filepath: String,
    pub post_suffix: String,
    pub pre_size: u64,
    pub post_size: u64,
}

impl ImageFile {
    /// Creates a new ImageFile instance
    pub fn new(filepath: &str) -> Result<Self, OptimizerError> {
        let path = Path::new(filepath);
        if !path.exists() {
            return Err(OptimizerError::FileNotFound(filepath.to_string()));
        }

        let pre_size = fs::metadata(filepath)?.len();
        let post_suffix = Self::get_post_suffix();
        let post_filepath = Self::get_post_filepath(filepath);

        Ok(ImageFile {
            pre_filepath: filepath.to_string(),
            post_filepath,
            post_suffix,
            pre_size,
            post_size: 0,
        })
    }

    /// Gets the post suffix for the optimized file
    fn get_post_suffix() -> String {
        "-crunch.png".to_string()
    }

    /// Gets the post filepath for the optimized file
    fn get_post_filepath(filepath: &str) -> String {
        let path = Path::new(filepath);
        let stem = path.file_stem().unwrap_or_default().to_string_lossy();
        let new_filename = format!("{}-crunch.png", stem);

        path.parent()
            .unwrap()
            .join(&new_filename)
            .to_string_lossy()
            .to_string()
    }

    /// Updates the post file size
    pub fn get_post_filesize(&mut self) -> Result<(), OptimizerError> {
        if Path::new(&self.post_filepath).exists() {
            self.post_size = fs::metadata(&self.post_filepath)?.len();
        }
        Ok(())
    }

    /// Calculates the compression percentage
    pub fn get_compression_percent(&self) -> f64 {
        if self.pre_size == 0 {
            return 100.0;
        }
        (self.post_size as f64 / self.pre_size as f64) * 100.0
    }

    /// Replaces the original file with the optimized version
    pub fn finalize_replacement(&mut self) -> Result<(), OptimizerError> {
        if Path::new(&self.post_filepath).exists() {
            // Remove the original file and rename the optimized file to take its place
            fs::remove_file(&self.pre_filepath)
                .map_err(|e| OptimizerError::FileOperationError(format!("Failed to remove original file: {}", e)))?;
            fs::rename(&self.post_filepath, &self.pre_filepath)
                .map_err(|e| OptimizerError::FileOperationError(format!("Failed to rename file: {}", e)))?;

            // Update post_size to reflect the replaced file
            self.post_size = fs::metadata(&self.pre_filepath)?.len();
            self.post_filepath = self.pre_filepath.clone();
        }
        Ok(())
    }
}

/// Runs a subprocess command
fn run_subprocess(command: &str) -> Result<std::process::ExitStatus, OptimizerError> {
    let output = Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()
        .map_err(|e| OptimizerError::ProcessExitError {
            code: -1,  // -1 indicates the process failed to start or execute (not an exit code)
            message: format!("Failed to start process: {}", e)
        })?;

    // Always return Ok with the exit status, even for non-zero exit codes
    // This allows the caller to handle different exit codes appropriately
    Ok(output.status)
}

/// Optimizes a PNG file using pngquant and zopflipng
pub fn optimize_png(filepath: &str, replace_original: bool) -> Result<(), OptimizerError> {
    let mut img = ImageFile::new(filepath)?;

    // Define paths for pngquant and zopflipng
    let pngquant_path = get_pngquant_path();
    let zopflipng_path = get_zopflipng_path();

    // First stage: pngquant
    let pngquant_options = format!(
        " --quality=80-98 --skip-if-larger --force --strip --speed 1 --ext {} ",
        img.post_suffix
    );
    let pngquant_command = format!("{}{}{}", pngquant_path, pngquant_options, shellquote(&img.pre_filepath));

    match run_subprocess(&pngquant_command) {
        Ok(status) => {
            // Check specific pngquant return codes
            if let Some(code) = status.code() {
                match code {
                    0 => {
                        // Success, no message needed
                    },
                    98 => {
                        // File size increased with execution of pngquant, this is normal
                        // Log this for informational purposes
                        eprintln!("pngquant: file size increased for {}, continuing to zopflipng", filepath);
                        // Continue to zopflipng stage
                    },
                    99 => {
                        // Image quality fell below the set min value, this is normal
                        // Log this for informational purposes
                        eprintln!("pngquant: quality below threshold for {}, continuing to zopflipng", filepath);
                        // Continue to zopflipng stage
                    },
                    _ => {
                        // Any other non-zero exit code is unexpected
                        eprintln!("pngquant exited with code {} for file {}", code, filepath);
                    }
                }
            }
        },
        Err(e) => {
            // Log the error but continue processing
            let error_msg = format!("pngquant failed for {}: {}", filepath, e);
            eprintln!("{}", error_msg);

            // Continue to zopflipng even if pngquant fails
        }
    }

    // Second stage: zopflipng
    let mut zopflipng_options = " -y --filters=0 ".to_string();

    // Confirm that a file with proper path was generated by pngquant
    // pngquant does not write expected file path if the file was larger after processing
    if !Path::new(&img.post_filepath).exists() {
        fs::copy(&img.pre_filepath, &img.post_filepath)
            .map_err(|e| OptimizerError::FileOperationError(format!("Failed to copy file: {}", e)))?;
        // If pngquant did not quantize the file, permit zopflipng to attempt compression
        // with multiple filters
        zopflipng_options = " -y --lossy_transparent ".to_string();
    }

    let zopflipng_command = format!(
        "{}{}{} {}",
        zopflipng_path,
        zopflipng_options,
        shellquote(&img.post_filepath),
        shellquote(&img.post_filepath)
    );

    match run_subprocess(&zopflipng_command) {
        Ok(status) => {
            // Check if zopflipng completed successfully (exit code 0)
            if let Some(code) = status.code() {
                if code != 0 {
                    // Handle non-zero exit codes for zopflipng
                    let error_msg = format!("zopflipng failed with exit code {} for file: {}", code, filepath);
                    eprintln!("{}", error_msg);
                    return Err(OptimizerError::ProcessExitError { code, message: error_msg });
                }
            }
            // zopflipng completed successfully
        },
        Err(e) => {
            // Log the error and return it
            let error_msg = format!("zopflipng failed for {}: {}", filepath, e);
            eprintln!("{}", error_msg);
            return Err(e);
        }
    }

    // Check file size post-optimization and report comparison
    img.get_post_filesize()?;
    let percent = img.get_compression_percent();

    // Replace original file if requested
    if replace_original {
        img.finalize_replacement()?;
    }

    let percent_string = format!("{:.2}%", percent);
    let status_string = if percent < 100.0 {
        format!("\x1b[0;32m{}\x1b[0m", percent_string) // Green color for compression
    } else {
        percent_string
    };

    // Report results to stdout
    println!(
        "[ {} ] {} ({} bytes)",
        status_string,
        img.post_filepath,
        img.post_size
    );

    // Report to log file
    // Note: We can't easily access the logger from here in the current module structure
    // For now, we'll skip logging to file from this function
    // In a more complete implementation, we would fix this module structure issue

    Ok(())
}

/// Gets the pngquant executable path
fn get_pngquant_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    format!("{}/.local/bin/pngquant", home)
}

/// Gets the zopflipng executable path
fn get_zopflipng_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    format!("{}/.local/bin/zopflipng", home)
}

/// Quotes a file path for shell usage
fn shellquote(filepath: &str) -> String {
    format!("'{}'", filepath.replace("'", "'\\\\''"))
}
