# GCD on web

A Rust project leveraging [actix_web](https://actix.rs/) and [serde](https://crates.io/crates/serde).

## Development

Using [cargo-watch](https://crates.io/crates/cargo-watch) for hot reloading.

```bash
cargo watch -w src -x run
```

- visit `http://localhost:4300` Welcome.
- visit `http://localhost:4300/gcd` for GCD calculation.
- visit `http://localhost:4300/hello/{name}` for Greetings.
