use std::env;
use std::time::Instant;

use mandelbrot::parse::{parse_complex, parse_pair};
use mandelbrot::render::{render, write_image};

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() != 5 {
        eprintln!("Usage: {} FILE PIXELS UPPER_LEFT LOWER_RIGHT", args[0]);
        eprintln!(
            "Example: {} mandelbrot.png 1000x750 -1.20,0.35 -1,0.20",
            args[0]
        );
        std::process::exit(1);
    }

    let bounds = parse_pair(&args[2], 'x').expect("error parsing image dimensions");
    let upper_left = parse_complex(&args[3]).expect("error parsing upper_left corner point");
    let lower_right = parse_complex(&args[4]).expect("error parsing lower right corner point");

    let start = Instant::now();
    let mut pixels = vec![0; bounds.0 * bounds.1];

    // A single thread way to draw image.
    render(&mut pixels, bounds, upper_left, lower_right);

    let elapsed = start.elapsed();
    println!("Render timing: {} ms", elapsed.as_millis());
    write_image(&args[1], &pixels, bounds).expect("error writing PNG file");
}
