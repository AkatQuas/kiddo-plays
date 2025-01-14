use assert_cmd::Command;
use predicates::prelude::*;
use std::fs;

// In the preceding code, `Box` indicates that the error will live inside a kind of pointer where the memory is dynamically allocated on the heap rather than the stack, and `dyn` indicates that the method calls on the `std::error::Error` trait are dynamically dispatched.
// the `Ok` part of TestResult will only ever hold  the unit type,
// and the `Err` part can hold anything that implements the `std::error::Error` trait.

type TestResult = Result<(), Box<dyn std::error::Error>>;

// --------------------------------------------------
#[test]
fn dies_no_args() -> TestResult {
    Command::cargo_bin("simple_echo")?
        .assert()
        .failure()
        .stderr(predicate::str::contains("USAGE"));
    Ok(())
}

#[test]
fn dies_no_args_more() -> TestResult {
    let result = Command::cargo_bin("simple_echo")?.assert().failure();

    let text = std::str::from_utf8(&result.get_output().stderr).expect("Invalid UTF-8 bytes");

    println!("{}", text);
    assert!(text.contains("USAGE:"));
    assert!(text.contains("simple_echo [FLAGS] <TEXT>"));
    Ok(())
}

// --------------------------------------------------
fn run(args: &[&str], expected_file: &str) -> TestResult {
    let expected = fs::read_to_string(expected_file)?;
    Command::cargo_bin("simple_echo")?
        .args(args)
        .assert()
        .success()
        .stdout(expected);
    Ok(())
}

// --------------------------------------------------
#[test]
fn hello1() -> TestResult {
    run(&["Hello there"], "tests/expected/hello1.txt")
}

// --------------------------------------------------
#[test]
fn hello2() -> TestResult {
    run(&["Hello", "there"], "tests/expected/hello2.txt")
}

// --------------------------------------------------
#[test]
fn hello1_no_newline() -> TestResult {
    run(&["Hello  there", "-n"], "tests/expected/hello1.n.txt")
}

// --------------------------------------------------
#[test]
fn hello2_no_newline() -> TestResult {
    run(&["-n", "Hello", "there"], "tests/expected/hello2.n.txt")
}
