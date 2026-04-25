//! Command line interface for crunch
//!
//! This module provides the command line interface for crunch using clap.

use clap::Parser;
use std::path::PathBuf;

/// A PNG file optimization tool built on pngquant and zopflipng
#[derive(Parser, Debug)]
#[clap(
    name = "crunch",
    version = "6.2.0",
    about = "A PNG file optimization tool built on pngquant and zopflipng",
    long_about = "crunch is a command line executable that performs lossy optimization of one or more png image files with pngquant and zopflipng. Processes multiple files concurrently for improved performance."
)]
pub struct Cli {
    /// Image files to optimize
    #[clap(value_name = "IMAGE")]
    pub files: Vec<PathBuf>,

    /// Replace original file with optimized version
    #[clap(short, long)]
    pub replace: bool,

    /// Output log content
    #[clap(short, long, value_name = "LINES", require_equals = true, default_missing_value = "200")]
    pub log: Option<Option<usize>>,
}