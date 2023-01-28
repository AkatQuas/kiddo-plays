use std::fmt::Debug;

trait Shape {
    fn area(&self) -> f64;
}

#[derive(Debug)]
struct Square {
    side: f64,
}

impl Shape for Square {
    fn area(&self) -> f64 {
        self.side * self.side
    }
}

#[derive(Debug)]
struct Circle {
    radius: f64,
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        self.radius * self.radius * std::f64::consts::PI
    }
}
fn print_info(shape: impl Shape + Debug) {
    println!("{:?} has area of {}", shape, shape.area());
}
fn print_info_generic<T: Shape + Debug>(shape1: T, shape2: T) {
    println!("Shape1: {:?} has area of {}", shape1, shape1.area());
    println!("Shape2: {:?} has area of {}", shape2, shape2.area());
}

fn print_info_verbose<T>(shape1: T, shape2: T)
where
    T: Shape + Debug,
{
    println!("Shape1: {:?} has area of {}", shape1, shape1.area());
    println!("Shape2: {:?} has area of {}", shape2, shape2.area());
}

pub fn trait_in_parameters() {
    let c = Circle { radius: 2.0 };
    print_info(c);
    print_info_generic(Square { side: 3.0 }, Square { side: 4.0 });
    print_info_verbose(Circle { radius: 3.0 }, Circle { radius: 4.0 });
}
