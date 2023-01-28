use std::mem;

pub fn array() {
    let mut a: [i32; 5] = [1, 2, 3, 4, 5];
    println!("Array a takes up {} bytes", mem::size_of_val(&a));
    println!("Array a[0] takes up {} bytes", mem::size_of_val(&a[0]));

    println!("a has {} elements, first is {}", a.len(), a[0]);
    a[0] = 321;
    println!("a has changed the first elements to be {}", a[0]);

    println!("a looks like {:?}", a);

    if a == [321, 2, 3, 4, 5] {
        println!("Match to be '[321, 2, 3, 4, 5]'");
    }

    let b = [1; 10];

    println!(
        "b looks like {:?} and takes up {} bytes",
        b,
        mem::size_of_val(&b)
    );

    for i in 0..b.len() {
        println!("b[{}] is {}", i, b[i]);
    }

    let multi_dimension: [[f32; 3]; 2] = [[1.0, 0.0, 0.0], [0.0, 2.0, 0.0]];
    println!(
        "multi_dimension looks like {:?}, takes up {} bytes",
        multi_dimension,
        mem::size_of_val(&multi_dimension)
    );
}
