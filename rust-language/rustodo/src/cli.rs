use std::path::PathBuf;
use structopt::StructOpt;

#[derive(Debug, StructOpt)]
pub enum Action {
    List,
    Add {
        #[structopt()]
        text: String,
    },
    Done {
        #[structopt()]
        index: usize,
    },
    Help,
}

#[derive(Debug, StructOpt)]
#[structopt(name = "rustodo", about = "A todo app in CLI")]
pub struct CommandLineOptions {
    #[structopt(subcommand)]
    pub action: Action,
    #[structopt(parse(from_os_str), short = "p", long = "path")]
    pub json_file_path: Option<PathBuf>,
}
