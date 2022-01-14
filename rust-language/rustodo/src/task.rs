use anyhow::Result;
use chrono::{serde::ts_seconds, DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt::Display;
use std::fs::OpenOptions;
use std::io::BufReader;
use std::path::PathBuf;

#[derive(Debug, Deserialize, Serialize)]
pub struct Task {
    pub text: String,
    #[serde(with = "ts_seconds")]
    pub created_at: DateTime<Utc>,
    pub done: Option<bool>,
}

impl Task {
    pub fn new(text: String) -> Self {
        Self {
            text,
            created_at: Utc::now(),
            done: Some(false),
        }
    }
}

impl Display for Task {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{:<40} [Created={}, Done={:?}]",
            self.text, self.created_at, self.done
        )
    }
}

pub fn add_task(task: Task, json_file_path: PathBuf) -> Result<()> {
    let mut file = OpenOptions::new()
        .append(false)
        .read(true)
        .write(true)
        .create(true)
        .open(json_file_path)
        .unwrap();

    let mut tasks = parse_tasks(&mut file)?;
    tasks.push(task);
    serde_json::to_writer(file, &tasks)?;
    Ok(())
}

fn parse_tasks(file: &std::fs::File) -> Result<Vec<Task>> {
    let reader = BufReader::new(file);
    let tasks: Vec<Task> = match serde_json::from_reader(reader) {
        Ok(tasks) => tasks,
        Err(err) if err.is_eof() => Vec::new(),
        Err(err) => Err(err)?,
    };
    Ok(tasks)
}

pub fn list_task(json_file_path: PathBuf) -> Result<()> {
    let file = OpenOptions::new().read(true).open(json_file_path)?;
    let tasks = parse_tasks(&file)?;
    if tasks.is_empty() {
        println!("Nothing to do, take a break!");
    } else {
        for (index, task) in tasks.iter().enumerate() {
            println!("{}: {}", index + 1, task);
        }
    }
    Ok(())
}

pub fn done_task(json_file_path: PathBuf, index: usize) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .read(true)
        .append(false)
        .open(json_file_path)
        .unwrap();

    let mut tasks = parse_tasks(&mut file)?;
    if tasks.is_empty() {
        return Ok(());
    }

    if let Some(elem) = tasks.get_mut(index - 1) {
        (*elem).done = Some(true);
        serde_json::to_writer(file, &tasks)?;
    }
    Ok(())
}
