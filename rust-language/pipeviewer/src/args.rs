use clap::{arg, Parser};
use std::env;

#[derive(Parser, Debug)]
pub struct Args {
    /// Use input file instead of stdin
    #[arg(short = 'i', long, help = "HaHa, Use input file instead of stdin")]
    pub input: Option<String>,

    /// Use output file instead of stdout
    #[arg(short = 'o', long)]
    pub output: Option<String>,

    /// Disable progress display
    #[arg(short, long, default_value_t = false)]
    pub silent: bool,
}

impl Args {
    /// Parse the arguments and patch some value with Environment variables
    pub fn parse_n_patch() -> Self {
        let mut args = Args::parse();
        let silent = if args.silent {
            true
        } else {
            !env::var("PV_SILENT").unwrap_or_default().is_empty()
        };
        args.silent = silent;
        args
    }
}
