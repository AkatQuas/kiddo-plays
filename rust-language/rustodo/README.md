# Todo CLI with Rust

A small practice on rust.

## How to play

```bash
# list all tasks
$ cargo run -- list

# output the help message
$ cargo run -- help

# add first todo
$ cargo run -- add "first"

# list all tasks
$ cargo run -- list

# add second todo
$ cargo run -- add "next"

# list all tasks again
$ cargo run -- list

# done first task
$ cargo run -- done 1

# list all tasks again
$ cargo run -- list
```

## Known issue

`serde_json` is appending the text to the end of the file, **not overwriting**, even though the file is opened with `append:false` option.

```rust
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

// ...

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
```
