struct Anime {
    name: &'static str,
    bechdel_pass: bool,
}

fn factorial(n: usize) -> usize {
    (1..n + 1).product()
}

fn smallest<'a>(v: &'a [i32]) -> &'a i32 {
    let mut s = &v[0];
    for r in &v[1..] {
        if *r < *s {
            s = r;
        }
    }

    s
}

pub fn basic() {
    let x = 10;
    let r = &x; // &x is a shared reference to x
    assert!(*r == 10); // explicitly dereference x

    let mut y = 32;
    let m = &mut y; // &mut y is a mutable reference to y
    *m += 10; // explicitly dereference m to set y's value
    assert!(*m == 42);

    let aria = Anime {
        name: "Aria: The Animation",
        bechdel_pass: true,
    };
    let aria_ref: &Anime = &aria;

    // the `.` operator implicitly dereference its left operand
    assert_eq!(aria_ref.name, "Aria: The Animation");

    // Equivalent to the above, but with the dereference written out
    assert_eq!((*aria_ref).name, "Aria: The Animation");

    // the `.` operator implicitly borrow a reference to its left operand
    let mut v = vec![1999, 1984];

    v.sort(); // implicitly borrows a mutable reference to `v`

    (&mut v).sort(); // equivalent but verbose
    assert_eq!(v, vec![1984, 1999]);

    let aria_ref_ref: &&Anime = &aria_ref; // ref twice
    let aria_ref_ref_ref: &&&Anime = &aria_ref_ref; // ref triple

    // `.` operator follows as many references as it takes to find its target
    assert_eq!(aria_ref_ref_ref.name, "Aria: The Animation");

    let x = 10;
    let y = 10;
    let rx: &i32 = &x;
    let ry: &i32 = &y;
    let rrx: &&i32 = &rx;
    let rry: &&i32 = &ry;

    assert!(rrx <= rry);
    // `==` operator follows all the references and
    // performs the comparison on the final targets
    assert!(rrx == rry);

    assert!(rx == ry);
    // rx / ry point to different address, but referents are equal
    assert_eq!(std::ptr::eq(rx, ry), false);

    // operands are same type
    assert!(rx == *rrx); // &i32 <-> &i32

    let r: &usize = &factorial(6);
    // Rust creates an anonymous variable to hold the value and
    //   make the reference point to that.
    // &1009 -> &i32
    assert_eq!(r + &1009, 1729);

    assert_eq!(smallest(&vec![2, 4, 1, 6, 8]), &1)
}
