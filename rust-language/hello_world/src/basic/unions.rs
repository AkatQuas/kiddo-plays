use std::mem;

union IntOrFloat {
    i: i32,
    f: f64,
}

// https://doc.rust-lang.org/reference/items/unions.html#pattern-matching-on-unions
fn process_value(iof: IntOrFloat) {
    unsafe {
        match iof {
            IntOrFloat { i: 42 } => {
                println!("meaning of life value");
            }

            IntOrFloat { f } => {
                println!("value = {}, takes up {} bytes", f, mem::size_of_val(&f));
            }
        }
    }
}

pub fn unions() {
    let iof = IntOrFloat { i: 42 };
    let value = unsafe { iof.i };
    println!("iof takes up {} bytes.", mem::size_of_val(&iof));

    println!(
        "iof.i = {}, the value takes up {} bytes.",
        value,
        mem::size_of_val(&value)
    );

    process_value(IntOrFloat { i: 42 });
    process_value(IntOrFloat { f: 42.0 });
    process_value(IntOrFloat { i: 21 });
}
