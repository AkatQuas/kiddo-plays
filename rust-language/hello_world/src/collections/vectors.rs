use std::mem;

pub fn vectors() {
    let mut a = Vec::new();
    a.push(1);
    a.push(2);
    println!(
        "Vector a \"{:?}\" takes up {} bytes",
        a,
        mem::size_of_val(&a)
    );
    a.push(3);
    println!(
        "Vector a \"{:?}\" takes up {} bytes",
        a,
        mem::size_of_val(&a)
    );

    let idx: usize = 0;
    a[idx] = 42;
    println!(
        "a[0] = {}, takes up {} bytes",
        a[0],
        mem::size_of_val(&a[0])
    );
    match a.get(6) {
        Some(x) => println!("a[6] = {}", x),
        None => println!("Error, no such element at index 6"),
    }

    for x in &a {
        println!("looping - {}", x);
    }

    let last_element = a.pop();

    println!(
        "Last element is {:?}, Vector a \"{:?}\" after popping.",
        last_element, a
    );

    while let Some(x) = a.pop() {
        println!("While pop {}", x);
    }

    let mut v = Vec::new();
    for i in 101..106 {
        v.push(i.to_string());
    }

    let fifth = v.pop().expect("vector empty!");
    assert_eq!(fifth, "105");

    // move the value out of a given index
    // and move the last element into its spot
    let second = v.swap_remove(1);
    assert_eq!(second, "102");

    let third = std::mem::replace(&mut v[2], "substitute".to_string());
    assert_eq!(third, "103");

    assert_eq!(v, vec!["101", "104", "substitute"]);
}
