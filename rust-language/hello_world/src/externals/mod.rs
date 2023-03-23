/*
  Visit https://crates.io/ for more.
*/

extern crate rand;

#[path = "../phrases/mod.rs"]
mod phrases;

use phrases::greetings::{chinese, english};

use rand::Rng;

/// Just for fun
pub fn run() {
    let mut rng = rand::thread_rng();
    let b: bool = rng.gen();

    println!("b is created by external crate \"rand\" with value {}", b);
    println!("{}", chinese::hello());
    println!("{}", english::hello());
}

#[test]
fn english_greeting_correct() {
    assert_eq!("hello", english::hello());
}

#[test]
#[should_panic]
fn chinese_greeting_panic() {
    assert_eq!("iKun", chinese::hello());
}

#[test]
#[ignore]
fn whatever_is_ignored() {
    assert_eq!("iKun", chinese::hello());
}
