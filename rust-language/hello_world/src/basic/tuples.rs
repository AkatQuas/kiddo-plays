use std::mem;

fn sum_and_product(x: i32, y: i32) -> (i32, i32) {
    (x + y, x * y)
}
fn triple(x: i32) -> (i32, i32, i32) {
    (x, 2 * x, 3 * x)
}
pub fn tuples() {
    let sp = sum_and_product(3, 4);
    println!("Result {:?}, takes up {} bytes.", sp, mem::size_of_val(&sp));
    let tp = triple(3);
    println!("Result {:?}, takes up {} bytes.", tp, mem::size_of_val(&tp));
    // destructure
    let (sum, product) = sp;
    println!("Sum is {}, Product is {}", sum, product);
    println!("Sum is {}, Product is {}", sp.0, sp.1);

    let combined = (sp, sum_and_product(4, 5));
    println!(
        "Combined Result {:?}, takes up {} bytes.",
        combined,
        mem::size_of_val(&combined)
    );
    println!("Last elements in Combined is {}", combined.1 .1);

    // destructure
    let ((c, d), (e, f)) = combined;

    let foo = (true, 42.0, -1i8);
    println!("Foo is {:?}", foo);

    // the comma is required
    let meaning = (42,);
    println!("Meaning from tuple {:?}", meaning);
}
