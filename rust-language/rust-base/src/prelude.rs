//! Crate prelude

// Re-export the crate error.
pub use crate::error::Error;

// Alias Result to the crate Result.
pub type Result<T> = core::result::Result<T, Error>;

// Generic Wrapper tuple struct for newtype pattern, mostly for external type to type From/TryFrom conversions.
pub struct W<T>(pub T);

// Personal preference.
pub use std::format as f;
