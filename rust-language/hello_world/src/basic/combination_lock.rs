#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_must_use)]

use std::io::stdin;
use std::mem;

enum State {
    Locked,
    Failed,
    Unlocked,
}

pub fn main() {
    let code = String::from("1234");
    let mut state = State::Locked;
    println!("state takes up {} bytes", mem::size_of_val(&state));
    let mut entry = String::new();

    loop {
        match state {
            State::Locked => {
                let mut input = String::new();
                match stdin().read_line(&mut input) {
                    Ok(_) => {
                        entry.push_str(&input.trim_end());
                    }
                    Err(_) => continue,
                }
                if entry == code {
                    state = State::Unlocked;
                    continue;
                }
                if code.starts_with(&entry) {
                    println!("The code is close enough!");
                } else {
                    state = State::Failed;
                }
            }
            State::Failed => {
                println!("{} is Failed", entry);

                entry.clear();
                state = State::Locked;
                continue;
            }
            State::Unlocked => {
                println!("Unlocked");
                return;
            }
        }
    }
}
