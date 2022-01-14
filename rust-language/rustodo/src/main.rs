mod cli;
mod task;
use anyhow::{anyhow, Result};
use cli::*;
use std::path::PathBuf;
use structopt::StructOpt;
use task::*;

fn main() -> Result<()> {
    let CommandLineOptions {
        action,
        json_file_path,
    } = CommandLineOptions::from_args();

    // println!("JSON file path: {:?}", json_file_path);
    let json_file_path = json_file_path
        .or_else(default_json_file_path)
        .ok_or(anyhow!("Failed to load json file"))?;

    match action {
        Action::List => list_task(json_file_path)?,
        Action::Add { text } => add_task(Task::new(text), json_file_path)?,
        Action::Done { index } => done_task(json_file_path, index)?,
        Action::Help => todo_help(),
    }
    Ok(())
}

fn default_json_file_path() -> Option<PathBuf> {
    home::home_dir().map(|mut path| {
        path.push(".rustodo.json");
        path
    })
}

fn todo_help() {
    println!("You can list/add/done/help with rustodo.")
}
