//! This is the module.
//!
//! # Example
//! ```
//! some code
//! more code
//! ```
//!

#![allow(dead_code)]
#![allow(unused_variables)]

mod basic;
mod collections;
mod concurrency;
mod externals;
mod references;

fn main() {
    basic::basic();
    collections::collections();
    references::references();
    concurrency::concurrency();
    externals::run();
}
