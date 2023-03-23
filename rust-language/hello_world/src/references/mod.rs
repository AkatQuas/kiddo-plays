mod atomic_rc;
mod circular;
mod mapping;
mod rc;

pub fn references() {
    rc::demo();
    atomic_rc::demo();
    circular::circular_references();
    mapping::mapping();
}
