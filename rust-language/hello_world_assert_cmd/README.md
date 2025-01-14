# Hello world / assert_cmd

```bash
cargo run --quiet --bin true
```

I used to build the target bin, run these executables, check the output manually.

Things are much easier with [assert_cmd](https://crates.io/crates/assert_cmd).

Write some test functions like those in [tests/cli](./tests/cli.rs) and just run `cargo test`

```rust
// example
#[test]
fn hello_world() {
    let mut cmd = Command::cargo_bin("hello").unwrap();
    cmd.assert().success().stdout("Hello, world!\n");
}
```

# Acknowledgement

A folk project from [Command-Line Rust](https://learning.oreilly.com/library/view/command-line-rust/9781098109424/) by Ken Youens-Clark.
