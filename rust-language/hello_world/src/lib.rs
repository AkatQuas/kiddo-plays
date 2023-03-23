//! This is a library crate. The library is so nice!
//! Nothing mysterious.

/// four() is a function that returns 4.
///
/// ```
/// use hello_world::four;
/// let x = four();
/// assert_eq!(x, 4);
/// ```
pub fn four() -> i32 {
    4
}

// make a lib create
pub mod phrases;

pub mod eat {
    pub fn rice() -> String {
        "rice".to_string()
    }
    pub fn noodles() -> String {
        "noodles".to_string()
    }
}

#[test]
fn it_works() {
    assert_eq!(4, four());
}
