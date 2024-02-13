use text_colorizer::*;

pub fn print_usage() {
    eprintln!(
        "{} - change occurrences of one string to another",
        "quickreplace".green()
    );
    println!("Usage: quickreplace <target> <replacement> <INPUT> <OUTPUT>");
}
