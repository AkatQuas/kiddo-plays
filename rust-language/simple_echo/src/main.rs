use clap::{App, Arg};

fn main() {
    let matches = App::new("simple_echo")
        .version("0.1.0")
        .author("Anonymous <dont-reply@github.com>")
        .about("Custom echo using Rust")
        .arg(
            Arg::with_name("text")
                .value_name("TEXT")
                .help("Input text to echo")
                .required(true)
                .min_values(1),
        )
        // .arg_from_usage("-c --config=<FILE> 'Set a config file to use'")
        .arg(
            Arg::with_name("omit_newline")
                .short("n")
                .help("Do not print newline when echoing")
                .takes_value(false),
        )
        .get_matches();

    dbg!(&matches);
    let text = matches.values_of_lossy("text").unwrap();
    let omit_newline = matches.is_present("omit_newline");
    print!("{}{}", text.join(" "), if omit_newline { "" } else { "\n" });

}
