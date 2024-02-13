use std::fs;

use text_colorizer::*;

mod args;
mod common;
mod replace;

fn main() {
    let args = args::parse_args();
    println!("Hello, world! {:?}", args);
    let data = match fs::read_to_string(&args.filename) {
        Ok(v) => v,
        Err(e) => {
            eprintln!(
                "{} failed to read from file '{}': {:?}",
                "Error.".red().bold(),
                args.filename,
                e
            );
            std::process::exit(1);
        }
    };

    let replaced_data = match replace::replace(&args.target, &args.replacement, &data) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("{} failed to replace text: {:?}", "Error:".red().bold(), e);
            std::process::exit(1);
        }
    };

    match fs::write(&args.output, &replaced_data) {
        Ok(v) => v,
        Err(e) => {
            eprintln!(
                "{} failed to write to file '{}': {:?}",
                "Error.".red().bold(),
                args.output,
                e
            );
            std::process::exit(1);
        }
    };
}
