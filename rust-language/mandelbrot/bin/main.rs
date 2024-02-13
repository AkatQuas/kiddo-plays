use std::env;
use std::time::Instant;

use mandelbrot::parse::{parse_complex, parse_pair};
use mandelbrot::pixel::pixel_to_point;
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

    // concurrently
    let threads = 8;
    let rows_per_band = bounds.1 / threads + 1;
    {
        let bands: Vec<&mut [u8]> = pixels.chunks_mut(rows_per_band * bounds.0).collect();
        crossbeam::scope(|spawner| {
            for (i, band) in bands.into_iter().enumerate() {
                // println!("thread {} working", i);
                let top = rows_per_band * i;
                let height = band.len() / bounds.0;
                let band_bounds = (bounds.0, height);
                let band_upper_left = pixel_to_point(bounds, (0, top), upper_left, lower_right);
                let band_lower_right =
                    pixel_to_point(bounds, (bounds.0, top + height), upper_left, lower_right);

                spawner.spawn(move |_| {
                    render(band, band_bounds, band_upper_left, band_lower_right);
                });
            }
        })
        .unwrap();
    }
    let elapsed = start.elapsed();
    println!("Render timing: {} ms", elapsed.as_millis());

    write_image(&args[1], &pixels, bounds).expect("error writing PNG file");
}
