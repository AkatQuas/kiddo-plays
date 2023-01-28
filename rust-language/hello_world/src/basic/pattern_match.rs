fn how_many(x: i32) -> &'static str {
    match x {
        0 => "no",
        1 | 2 => "one or two",
        z @ 3..=4 => "few",
        9..=11 => "lots of",
        12 => "a dozen",
        _ if (x % 2 == 0) => "some",
        _ => "a few",
    }
}

fn detect_point(p: (i32, i32)) {
    match p {
        (0, 0) => println!("origin point"),
        (0, y) => println!("x axis, y = {}", y),
        (x, 0) => println!("y axis, x = {}", x),
        (x, y) => println!("Where do you get this point ({}, {})?", x, y), // (_, y) => println!("Where do you get this point (?, {})?", x, y)
                                                                           // (x, _) => println!("Where do you get this point ({}, ?)?", x, _)
    }
}

pub fn pattern_matching() {
    for x in 0..13 {
        println!("{}: I have {} oranges", x, how_many(x));
    }

    detect_point((3, 4));
    detect_point((0, 4));
    detect_point((3, 0));
    detect_point((0, 0));
}
