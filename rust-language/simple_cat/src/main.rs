fn main() {
    if let Err(e) = simple_cat::get_args().and_then(simple_cat::run) {
        eprintln!("{}", e);
        std::process::exit(1);
    }
}
