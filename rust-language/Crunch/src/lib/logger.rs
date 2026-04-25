//! Logging functionality for crunch
//!
//! This module provides functions for logging information and errors to a log file.

use std::fs::{OpenOptions, create_dir_all};
use std::io::{Write, BufWriter};
use std::time::{SystemTime, UNIX_EPOCH};

/// Default directory for crunch logs
pub const CRUNCH_DOT_DIRECTORY: &str = ".local/state/crunch";

/// Default log file path
pub const LOGFILE_PATH: &str = ".local/state/crunch/crunch.log";

/// Logs an error message to the log file
///
/// # Arguments
///
/// * `errmsg` - The error message to log
pub fn log_error(errmsg: &str) -> Result<(), std::io::Error> {
    log_message("ERROR", errmsg)
}

/// Logs an info message to the log file
///
/// # Arguments
///
/// * `infomsg` - The info message to log
pub fn log_info(infomsg: &str) -> Result<(), std::io::Error> {
    log_message("INFO", infomsg)
}

/// Logs a message with a specific level to the log file
///
/// # Arguments
///
/// * `level` - The log level (e.g., "INFO", "ERROR")
/// * `message` - The message to log
fn log_message(level: &str, message: &str) -> Result<(), std::io::Error> {
    // Create the log directory if it doesn't exist
    let log_dir = std::path::Path::new(CRUNCH_DOT_DIRECTORY);
    if !log_dir.exists() {
        create_dir_all(log_dir)?;
    }

    // Get current timestamp
    let start = SystemTime::now();
    let since_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    let current_time = format!("{:?}", since_epoch);

    // Open log file in append mode
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(LOGFILE_PATH)?;

    let mut writer = BufWriter::new(file);
    writeln!(writer, "{}\t{}\t{}", current_time, level, message)?;
    writer.flush()
}

/// Prints the last N lines of the log file
///
/// # Arguments
///
/// * `num_lines` - Number of lines to print (default: 200)
pub fn print_log(num_lines: usize) -> Result<(), std::io::Error> {
    if !std::path::Path::new(LOGFILE_PATH).exists() {
        println!("Log file not found: {}", LOGFILE_PATH);
        return Ok(());
    }

    let content = std::fs::read_to_string(LOGFILE_PATH)?;
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        println!("Log file is empty.");
        return Ok(());
    }

    let start_index = if lines.len() > num_lines {
        lines.len() - num_lines
    } else {
        0
    };

    println!("--- Last {} lines of {} ---", lines.len() - start_index, LOGFILE_PATH);
    for line in &lines[start_index..] {
        println!("{}", line);
    }

    Ok(())
}