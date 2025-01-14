# custom simple `echo` in Rust

`cargo run -- -h` to show the usage.

Run `./gen-fixtures.sh` to generate some test fixtures.

Check out the test functions in [cli.rs](./tests/cli.rs) and run `cargo test`.

```rust
#[test]
fn run() {
    let mut cmd = Command::cargo_bin("simple_echo")?;
    cmd.arg("hello").assert().success();
}
```

# Acknowledgement

A folk project from [Command-Line Rust](https://learning.oreilly.com/library/view/command-line-rust/9781098109424/) by Ken Youens-Clark.
