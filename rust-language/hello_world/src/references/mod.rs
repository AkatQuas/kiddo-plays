mod atomic_rc;
mod basic;
mod circular;
mod mapping;
mod rc;

pub fn references() {
    basic::basic();
    rc::demo();
    atomic_rc::demo();
    circular::circular_references();
    mapping::mapping();
}
