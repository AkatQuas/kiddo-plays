pub fn print_value(x: i32) {
    println!("value is {}.", x);
    let mut z = 41;
    increase(&mut z);
    println!("after increment, value of Z is {}.", z);

    println!("Product of (3, 4) is {}.", product(3, 4));
}

fn increase(x: &mut i32) {
    *x += 1;
}

fn product(x: i32, y: i32) -> i32 {
    // no semi-colon in the end
    x * y
}

fn say_hell() {
    println!("Say Hello to 42 from closure!");
}

pub fn closures() {
    let fn_s_h = say_hell;
    fn_s_h();

    // use `|` instead of `(` or `)`
    // T: value
    let plus_one = |x: i32| -> i32 { x + 1 };

    let a = 41;
    println!("Closure increment, {} to be {}.", a, plus_one(a));

    let mut two = 2;
    let plus_two = |x| {
        let mut z = x;
        z += two;
        z
    };

    // T&: by reference
    println!("Closure increment twice, {} to be {}.", 3, plus_two(3));
    // we can borrow the value after usage in closure
    let borrow_two = &mut two;

    // &mut &: mutable reference
    let plus_three = |x: &mut i32| {
        *x += 3;
    };

    let mut f = 12;
    plus_three(&mut f);
    println!("After plus_three, f is {}", f);

    /*  */
    let mut x = 5;

    let mut closure = || {
        println!("In Closure, the captured value of x is: {}", x);
        x = 7;
        println!(
            "In Closure, after mutation The captured value of x is: {}",
            x
        );
    };

    closure();

    // rustc --explain E0434
    // A variable used inside an inner function comes from a dynamic environment.
    //
    // fn bad() {
    //     println!("nested fn, x is {}", x);
    // }

    fn f() { // return type is `()`.
        return;
        // equivalent returning `()`, the unit type.
        // return ();
    }
}
