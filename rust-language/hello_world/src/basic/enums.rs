use std::mem;

enum Color {
    Red,
    Green,
    Blue,
    RGB(u8, u8, u8), // tuple
    CMYK {
        cyan: u8,
        magenta: u8,
        yellow: u8,
        black: u8,
    }, // struct
}

fn match_color(c: Color) {
    println!("c takes up {} bytes.", mem::size_of_val(&c));
    match c {
        Color::Red => println!("Red"),
        Color::Blue => println!("Blue"),
        Color::Green => println!("Green"),
        Color::RGB(0, 0, 0) => println!("Black"),
        Color::RGB(r, g, b) => println!("RGB({}, {}, {})", r, g, b),
        // ignore the rest
        Color::CMYK {
            cyan: _,
            magenta: _,
            yellow: _,
            black: 255,
        } => println!("CMYK(black)"),
        // ignore the rest with two dots `..`
        Color::CMYK { black: 250, .. } => println!("CMYK(black250)"),
        Color::CMYK {
            cyan,
            magenta,
            yellow,
            black,
        } => println!("CMYK({}, {}, {}, {})", cyan, magenta, yellow, black),
    }
}

pub fn enums() {
    match_color(Color::Red);
    match_color(Color::Green);
    match_color(Color::Blue);
    match_color(Color::RGB(0, 0, 0));
    match_color(Color::RGB(0, 11, 22));
    match_color(Color::CMYK {
        cyan: 0,
        magenta: 11,
        yellow: 122,
        black: 250,
    });
    match_color(Color::CMYK {
        cyan: 0,
        magenta: 11,
        yellow: 22,
        black: 255,
    });
    match_color(Color::CMYK {
        cyan: 0,
        magenta: 11,
        yellow: 22,
        black: 88,
    });
}
