///
/// This project has the same functionality as `minigrep`.
/// But the implementation is more functional-programming style.
/// See https://doc.rust-lang.org/book/ch13-03-improving-our-io-project.html
///
use std::env;
use std::process;

use minigrep::Config;

// Improve the project using Iterator.
// https://doc.rust-lang.org/book/ch13-03-improving-our-io-project.html

fn main() {
    // read command line arguments

    let config = Config::new(env::args()).unwrap_or_else(|err| {
        eprintln!("Problem parsing arguments. [err={}]", err);
        process::exit(1);
    });

    println!("Searching for \"{}\"...", config.query);
    println!("In file \"{}\":\n", config.filename);

    if let Err(e) = minigrep::run(config) {
        eprintln!("Application execution error. [err={}]", e);

        process::exit(1);
    }
}

#[warn(dead_code)]
fn naive_parse_config(args: &[String]) -> Config {
    let query = args[1].clone();
    let filename = args[2].clone();

    Config {
        query,
        filename,
        case_sensitive: false,
    }
}
