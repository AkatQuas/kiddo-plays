use std::env;
use std::error::Error;
use std::fs;

pub struct Config {
  pub query: String,
  pub filename: String,
  pub case_sensitive: bool,
}

impl Config {
  pub fn new(args: &[String]) -> Result<Config, &str> {
    if args.len() < 3 {
      return Err("not enough arguments");
    }
    let query = args[1].clone();
    let filename = args[2].clone();

    // not set CASE_INSENSITIVE, `var` throw an Result<VarError>
    // `is_err` return true
    // so CASE_SENSITIVE

    // set CASE_INSENSITIVE, `var` return Result<String>
    // `is_err` return false
    // so CASE_INSENSITIVE
    let case_sensitive = env::var("CASE_INSENSITIVE").is_err();
    Ok(Config {
      query,
      filename,
      case_sensitive,
    })
  }
}

pub fn run(config: Config) -> Result<(), Box<dyn Error>> {
  let contents = fs::read_to_string(config.filename)?;

  // println!("With text:\n{}", contents);

  let results = if config.case_sensitive {
    search(&config.query, &contents)
  } else {
    search_case_insensitive(&config.query, &contents)
  };

  for line in results {
    println!("{}", line);
  }

  Ok(())
}

pub fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
  // let mut results: Vec<&'a str> = Vec::new();
  let mut results = Vec::new();

  for line in contents.lines() {
    if line.contains(query) {
      results.push(line);
    }
  }
  results
}

fn search_case_insensitive<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
  let query = query.to_lowercase();
  let mut results: Vec<&'a str> = Vec::new();
  for line in contents.lines() {
    if line.to_lowercase().contains(&query) {
      results.push(line);
    }
  }
  results
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn case_sensitive() {
    let query = "duct";
    let contents = "\
Rust;
productive, fast, safe.
Pick three.
Duct tape.";

    assert_eq!(vec!["productive, fast, safe."], search(query, contents));
  }

  #[test]
  fn case_insensitive() {
    let query = "rUSt";
    let contents = "\
Rust;
productive, fast, safe.
Pick three.
Trust you.";

    assert_eq!(
      vec!["Rust;", "Trust you."],
      search_case_insensitive(query, contents)
    )
  }
}
