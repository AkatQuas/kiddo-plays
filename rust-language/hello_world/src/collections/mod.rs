mod dispatches;
mod hashmap;
mod hashset;
mod operator_overloading;
mod strings;
mod traits;
mod vectors;

pub fn collections() {
    println!("--- Collections Start ---");
    vectors::vectors();
    hashmap::hashmap();
    hashset::hashset();
    strings::strings();
    strings::formation();
    traits::traits();
    operator_overloading::overloading();
    dispatches::do_dispatch();
    dispatches::loop_dynamic_dispatch();
    dispatches::trait_with_dynamic_dispatch();
    println!("--- Collections End ---");
}
