use std::collections::HashMap;
use std::mem;

pub fn hashmap() {
    let mut shapes = HashMap::new();
    println!(
        "HashMap {:?} takes up {} bytes",
        shapes,
        mem::size_of_val(&shapes)
    );

    shapes.insert(String::from("triangle"), 3);
    shapes.insert(String::from("square"), 4);
    println!(
        "After insertion, HashMap {:?} takes up {} bytes",
        shapes,
        mem::size_of_val(&shapes)
    );

    println!("A Square has {} sides.", shapes["square".into()]);

    shapes.entry("circle".into()).or_insert(1);

    for (key, value) in &shapes {
        println!("{}: {}", key, value);
    }
}
