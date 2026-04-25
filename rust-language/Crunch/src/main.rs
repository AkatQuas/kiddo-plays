//! Main entry point for crunch
//!
//! This is the main entry point for the crunch CLI tool.

mod cli;
mod lib;

use clap::Parser;
use cli::Cli;
use lib::optimizer::optimize_png;
use lib::png_validator::is_valid_png;
use lib::logger::{print_log, CRUNCH_DOT_DIRECTORY};
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// Global flag to indicate if we should terminate
static TERMINATING: AtomicBool = AtomicBool::new(false);

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse command line arguments
    let cli = Cli::parse();

    // Handle log output
    if let Some(log_lines) = cli.log {
        let lines = log_lines.unwrap_or(200);
        print_log(lines)?;
        return Ok(());
    }

    // Create the Crunch dot directory in $HOME if it does not exist
    // This is used for logging
    if !cli.files.is_empty() {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let crunch_dir = format!("{}/{}", home, CRUNCH_DOT_DIRECTORY);
        if !std::path::Path::new(&crunch_dir).exists() {
            fs::create_dir_all(&crunch_dir)?;
        }
    }

    // Check if we have files to process
    if cli.files.is_empty() {
        eprintln!("[ ! ] Please include one or more paths to PNG image files as arguments to the script.");
        std::process::exit(1);
    }

    // Register signal handler for graceful shutdown
    let terminating = Arc::new(AtomicBool::new(false));
    let terminating_clone = terminating.clone();

    ctrlc::set_handler(move || {
        println!("\nReceived interrupt signal. Terminating all processes...");
        terminating_clone.store(true, Ordering::SeqCst);
        TERMINATING.store(true, Ordering::SeqCst);
        std::process::exit(130); // 128 + SIGINT (2)
    })?;

    // Validate files and check dependencies
    let mut valid_files = Vec::new();

    for file in &cli.files {
        let file_str = file.to_string_lossy();

        // Check if file exists
        if !file.exists() {
            eprintln!("[ ! ] Warning: '{}' does not appear to be a valid path to a PNG file. Skipping...", file_str);
            continue;
        }

        // Validate PNG
        if !is_valid_png(&file_str) {
            eprintln!("[ ! ] Warning: '{}' is not a valid PNG file. Skipping...", file_str);
            continue;
        }

        valid_files.push(file_str.to_string());
    }

    // If no valid files remain, exit
    if valid_files.is_empty() {
        eprintln!("[ ! ] No valid PNG files found to process.");
        std::process::exit(1);
    }

    // Check dependencies
    let pngquant_path = get_pngquant_path();
    let zopflipng_path = get_zopflipng_path();

    if !std::path::Path::new(&pngquant_path).exists() {
        eprintln!("[ ! ] pngquant executable was not identified on path '{}'", pngquant_path);
        std::process::exit(1);
    }

    if !std::path::Path::new(&zopflipng_path).exists() {
        eprintln!("[ ! ] zopflipng executable was not identified on path '{}'", zopflipng_path);
        std::process::exit(1);
    }

    // Process files
    println!("Crunching ...");

    if valid_files.len() == 1 {
        // Process single file
        if let Err(e) = optimize_png(&valid_files[0], cli.replace) {
            eprintln!("[ ! ] Error processing file: {:?}", e);
            std::process::exit(1);
        }
    } else {
        // Process multiple files concurrently
        use std::thread;
        use std::sync::mpsc;

        println!("Spawning {} processes to optimize {} image files...",
                 std::cmp::min(num_cpus::get(), valid_files.len()),
                 valid_files.len());

        // Create a channel for collecting results
        let (tx, rx) = mpsc::channel();

        // Spawn threads for each file
        let mut handles = vec![];
        let replace_original = cli.replace;
        for file in valid_files {
            let tx = tx.clone();
            let file_clone = file.clone();
            let replace_clone = replace_original;
            let handle = thread::spawn(move || {
                let result = optimize_png(&file_clone, replace_clone);
                tx.send((file_clone, result)).unwrap();
            });
            handles.push(handle);
        }

        // Store the number of files for later use
        let total_files = handles.len();

        // Drop the original sender to prevent hanging
        drop(tx);

        // Collect results
        let mut error_count = 0;
        for _ in 0..total_files {
            if TERMINATING.load(Ordering::SeqCst) {
                break;
            }

            if let Ok((file, result)) = rx.recv() {
                if let Err(e) = result {
                    eprintln!("[ ! ] Error processing file '{}': {:?}", file, e);
                    error_count += 1;
                }
            }
        }

        // Wait for all threads to complete and collect results
        for handle in handles {
            if let Err(e) = handle.join() {
                eprintln!("[ ! ] Thread panicked: {:?}", e);
                error_count += 1;
            }
        }

        if error_count > 0 {
            eprintln!("[ ! ] {} out of {} files failed to process.", error_count, total_files);
        }
    }

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