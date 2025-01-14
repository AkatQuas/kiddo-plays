use std::{
    error::Error,
    fs::File,
    io::{self, BufRead, BufReader},
};

use clap::{App, Arg};
type MyResult<T> = Result<T, Box<dyn Error>>;

#[derive(Debug)]
pub struct Config {
    files: Vec<String>,
    number_lines: bool,
    number_nonblank_lines: bool,
}

// Use `BufReader` to allocate memory on the heap,
// and put the return value into a `Box`,
// which is a pointer with a known size.
fn open(filename: &str) -> MyResult<Box<dyn BufRead>> {
    match filename {
        "-" => Ok(Box::new(BufReader::new(io::stdin()))),
        _ => Ok(Box::new(BufReader::new(File::open(filename)?))),
    }
}

fn print_content(
    reader: Box<dyn BufRead>,
    print_number: bool,
    print_nonblank: bool,
) -> MyResult<()> {
    let mut last_num = 0;

    for (_, line_content) in reader.lines().enumerate() {
        let line = line_content?;
        if print_number {
            last_num += 1;
            println!("{:6}\t{}", last_num, line);
        } else if print_nonblank {
            if line.is_empty() {
                println!();
            } else {
                last_num += 1;
                println!("{:6}\t{}", last_num, line);
            }
        } else {
            println!("{}", line);
        }
    }

    Ok(())
}

pub fn get_args() -> MyResult<Config> {
    let matches = App::new("simple_cat")
        .version("0.1.0")
        .author("Anonymous <no-reply@github.com>")
        .about("cat in Rust, simplified")
        .arg(
            Arg::with_name("files")
                .value_name("FILE")
                .multiple(true)
                .default_value("-")
                .help("Input file(s)"),
        )
        .arg(
            Arg::with_name("number")
                .short("n")
                .long("number")
                .conflicts_with("number_nonblank")
                .help("Number lines")
                .takes_value(false),
        )
        .arg(
            Arg::with_name("number_nonblank")
                .short("b")
                .long("number-nonblank")
                .help("Number non-blank lines")
                .takes_value(false),
        )
        .get_matches();

    Ok(Config {
        files: matches.values_of_lossy("files").unwrap(),
        number_lines: matches.is_present("number"),
        number_nonblank_lines: matches.is_present("number_nonblank"),
    })
}
pub fn run(config: Config) -> MyResult<()> {
    dbg!(&config);
    for filename in config.files {
        match open(&filename) {
            Err(err) => eprintln!("Failed to open {}: {}", filename, err),
            Ok(file) => print_content(file, config.number_lines, config.number_nonblank_lines)?,
        }
    }
    Ok(())
}
