use image::{codecs::png::PngEncoder, ImageEncoder};
use image::{ColorType, ImageResult};
use std::fs::File;

use num::Complex;

use crate::{math::escape_time, pixel::pixel_to_point};

/// Render a rectangle of the Mandelbrot set into a buffer of pixels.
///
/// The `bounds` argument gives the width and height of the buffer `pixels`,
/// which holds one grayscale pixel per byte. The `upper_left` and `lower_right` arguments specify points on the complex plane corresponding to the upper-left and lower-right corners of the pixel buffer.
pub fn render(
    pixels: &mut [u8],
    bounds: (usize, usize),
    upper_left: Complex<f64>,
    lower_right: Complex<f64>,
) {
    assert!(pixels.len() == bounds.0 * bounds.1);

    for row in 0..bounds.1 {
        for column in 0..bounds.0 {
            let point = pixel_to_point(bounds, (column, row), upper_left, lower_right);
            pixels[row * bounds.0 + column] = match escape_time(point, 255) {
                None => 0,
                Some(count) => 255 - count as u8,
            };
        }
    }
}

pub fn write_image(filename: &str, pixels: &[u8], bounds: (usize, usize)) -> ImageResult<()> {
    let output = File::create(filename)?;
    let encoder = PngEncoder::new(output);
    encoder.write_image(&pixels, bounds.0 as u32, bounds.1 as u32, ColorType::L8)
}
