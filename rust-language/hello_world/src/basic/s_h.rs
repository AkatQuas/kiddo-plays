#![allow(dead_code)]

use std::mem;

struct Point {
    x: f64,
    y: f64,
}
struct Line {
    start: Point,
    end: Point,
}

impl Line {
    fn len(&self) -> f64 {
        let dx = self.start.x - self.end.x;
        let dy = self.start.y - self.end.y;
        (dx * dx + dy * dy).sqrt()
    }
}
fn origin() -> Point {
    Point { x: 0.0, y: 0.0 }
}
pub fn stack_and_heap() {
    println!("Stack and Heap");
    let p1 = origin();
    let p2 = Box::new(origin());

    println!("p1 takes up {} bytes", mem::size_of_val(&p1));
    println!("p1 is at ({}, {}).", p1.x, p1.y);

    println!("p2 takes up {} bytes", mem::size_of_val(&p2));

    let p3 = *p2;

    println!("p3 takes up {} bytes", mem::size_of_val(&p3));

    let start_point = Point { x: 3.0, y: 4.0 };
    let end_point = Point { x: 5.0, y: 10.0 };
    let my_line = Line {
        start: start_point,
        end: end_point,
    };
    println!("The length of myLine is {}", my_line.len());
}
