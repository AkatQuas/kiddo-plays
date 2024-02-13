use num::Complex;

#[allow(dead_code)]
fn square_loop(mut x: f64) {
    loop {
        x = x * x;
    }
}

#[allow(dead_code)]
fn square_add_loop(c: f64) {
    let mut x = 0.;
    loop {
        x = x * x + c;
    }
}

#[allow(dead_code)]
fn complex_square_add_loop(c: Complex<f64>) {
    let mut z = Complex { re: 0.0, im: 0.0 };
    loop {
        z = z * z + c;
    }
}

/// Try to determine if `c` is in the Mandelbrot set, using at most `limit` iteration to decide.
///
/// If `c` is not a member, return `Some(i)`, where `i` is the number of iterations it took for `c` to leave the circle of radius 2 centered on the origin.
///
/// If `c` seems to be a member (more precisely, if we reached the iteration limit without being able to prove that `c` is not member), return `None`.
pub fn escape_time(c: Complex<f64>, limit: usize) -> Option<usize> {
    let mut z = Complex { re: 0.0, im: 0.0 };
    for i in 0..limit {
        if z.norm_sqr() > 4.0 {
            return Some(i);
        }
        z = z * z + c;
    }

    None
}
