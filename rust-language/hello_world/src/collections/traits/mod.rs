mod basic;
mod drop;
mod into;
mod parameters;
mod patched;

pub fn traits() {
    basic::basic_traits();
    patched::monkey_patch_traits();
    parameters::trait_in_parameters();
    into::make_into();
    drop::make_drops();
}
