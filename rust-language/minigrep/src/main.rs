use std::env;
use std::process;

use minigrep::Config;

// Improve the project using Iterator.
// https://doc.rust-lang.org/book/ch13-03-improving-our-io-project.html

fn main() {
    // read command line arguments
    let args: Vec<String> = env::args().collect();

    // println!("{:?}", args);
    let executable = &args[0];
    println!("Running executable {}", executable);

    // let config = parse_config(&args);
    let config = Config::new(&args).unwrap_or_else(|err| {
        eprintln!("Problem parsing arguments: {}", err);
        process::exit(1);
    });

    println!("Searching for \"{}\"...", config.query);
    println!("In file \"{}\":\n", config.filename);

    if let Err(e) = minigrep::run(config) {
        eprintln!("Application error: {}", e);

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
