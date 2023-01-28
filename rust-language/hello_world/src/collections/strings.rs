use std::mem;

pub fn strings() {
    let s: &'static str = "hello 42!"; // &str ==> string slice

    println!(
        "Static Sliced String {:?} takes up {} bytes",
        s,
        mem::size_of_val(&s)
    );

    for c in s.chars() {
        println!("{}", c);
    }
    for c in s.chars().rev() {
        println!("{}", c);
    }

    if let Some(first_char) = s.chars().nth(0) {
        println!("First letter is {}", first_char);
    }

    // String
    let mut letters = String::new();
    println!(
        "Empty String letters takes up {} bytes.",
        mem::size_of_val(&letters)
    );
    let mut a = 'a' as u8;
    while a <= ('z' as u8) {
        letters.push(a as char);
        letters.push_str(", ");
        a += 1;
    }
    println!(
        "All letters is {}, which takes up {} bytes.",
        letters,
        mem::size_of_val(&letters)
    );

    let u: &str = &letters;
    println!(
        "Sliced letters {} takes up {} bytes",
        u,
        mem::size_of_val(&u)
    );

    let prefix = String::from("[Prefix]");

    // concatenation
    // String + st
    let z = prefix + u;
    println!(
        "Concatenate string {} takes up {} bytes",
        z,
        mem::size_of_val(&z)
    );
}

pub fn formation() {
    let name = "Dmitri";
    let greeting = format!("hi, I'm {}, nice to meet you", name);

    println!(
        "{} takes up {} bytes.",
        greeting,
        mem::size_of_val(&greeting)
    );

    let hello = "hello";
    let rust = "42";
    println!("{}, {}!", hello, rust);

    let run = "run";
    let forest = "forest";
    let run_forest_run = format!("{0}, {1}, {0}", run, forest);
    println!("{}", run_forest_run);

    let first = "James";
    let last = "Bond";
    let info = format!(
        "the name is {last}. {first} {last}.",
        last = last,
        first = first
    );

    println!("{}", info);

    let mixed = format!("{1} {} {0} {} {delta}", "alpha", "beta", delta = "delta");
    println!("{}", mixed);
}
