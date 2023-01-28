use std::mem;

struct Point<T> {
    x: T,
    y: T,
}

pub fn generics() {
    let a: Point<i32> = Point { x: 0, y: 0 };
    println!(
        "Point<i32> a{{{}, {}}} takes up {} bytes",
        a.x,
        a.y,
        mem::size_of_val(&a)
    );

    let a: Point<u16> = Point { x: 0, y: 0 };
    println!(
        "Point<u16> a{{{}, {}}} takes up {} bytes",
        a.x,
        a.y,
        mem::size_of_val(&a)
    );

    let p: Point<f64> = Point { x: 1.2, y: 2.4 };
    println!(
        "Point<f64> p{{{}, {}}} takes up {} bytes",
        p.x,
        p.y,
        mem::size_of_val(&p)
    );

    let p: Point<f64> = Point { x: 1.2, y: 2f64 };
    println!(
        "Point<f64> p{{{}, {}}} takes up {} bytes",
        p.x,
        p.y,
        mem::size_of_val(&p)
    );
}
