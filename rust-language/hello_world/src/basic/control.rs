#![allow(dead_code)]

pub fn if_statement(temp: i32) {
    println!("----------------------");
    println!("We have temperature {}", temp);

    if temp > 30 {
        println!("Temperature is over 30");
    } else if temp < 10 {
        println!("Very cold");
    } else {
        println!("Temperature is OK");
    }

    let day = if temp > 20 { "sunny" } else { "cloudy" };

    println!("Today is {}", day);
    println!(
        "Today is {}",
        if temp > 20 {
            "hot"
        } else if temp < 10 {
            "cold"
        } else {
            "ok"
        }
    );
    println!(
        "Today is {}",
        if temp > 20 {
            if temp > 30 {
                "very hot"
            } else {
                "hot"
            }
        } else if temp < 10 {
            "cold"
        } else {
            "ok"
        }
    );
}

pub fn while_loop() {
    let mut x = 1;
    while x < 1000 {
        if x == 64 {
            println!("This is magic number {}", x);
        } else {
            println!("x = {}", x);
        }
        x *= 2;
    }

    println!("finally x is {}", x);

    let mut y = 1;
    loop {
        y *= 2;

        println!("y = {}", y);

        if y >= 1 << 10 {
            break;
        }
    }

    println!("finally y is {}", y);
}

pub fn for_loop() {
    for x in 1..11 {
        if x == 3 {
            println!("hidden x = {}", x);
            continue;
        }
        println!("x = {}", x);
    }

    for (idx, value) in (30..41).enumerate() {
        println!("idx = {} with value = {}", idx, value);
    }
}

pub fn match_statement(code: i32) {
    let result = match code {
        44 => "four four",
        42 => "Universe",
        1..=10 => "Pupil",
        _ => "Invalid",
    };

    println!("With code {} comes \"{}\"", code, result);
}
