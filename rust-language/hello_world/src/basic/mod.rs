mod arrays;
mod combination_lock;
mod control;
mod enums;
mod functions;
mod generics;
mod high_order_functions;
mod lifetime;
mod options;
mod pattern_match;
mod s_h; // stack and heap
mod slices;
mod tuples;
mod unions;

use std::mem;

const MEANING_OF_LIFE: u8 = 42; // no fixed address
static ULTRA_MAN: i32 = 4287;

fn scope_and_shadowing() {
    let a = 123;

    {
        let b = 456;
        println!("inside, b = {}", b);

        let a = 777;
        println!("inside, a = {}", a);
    }

    println!("outside, a = {}", a);
}

fn operators() {
    // arithmetic
    let mut a = 2 + 3 * 4;
    a = a + 1;
    a -= 2;
    a *= 3;
    println!("a = {}", a);
    println!("reminder of {} / {} = {}", a, 4, (a % 4));

    let a_cubed = i32::pow(a, 3);

    println!("{} cubed is {}", a, a_cubed);

    let b = 2.5;
    /* integer power */
    let b_cubed = f64::powi(b, 3);
    /* float power */
    let b_to_pi = f64::powf(b, std::f64::consts::PI);
    println!("{} cubed is {}, {}^pi = {}", b, b_cubed, b, b_to_pi);

    // bitwise
    let c = 1 | 2; // 01 OR 10 = 11 == 3_10

    println!("1|2 = {}", c);

    let one_left_shift_10bit = 1 << 10;
    let one024_right_shift_8bit = 1024 >> 8;

    println!("1<<10 = {}", one_left_shift_10bit);
    println!("1024>>8 = {}", one024_right_shift_8bit);

    // arithmetic compare
    // <, >, >=, <=, ==
}

fn fundamental_data_types() {
    let mut c = 1234556789;
    println!("c = {}, size = {} bytes.", c, mem::size_of_val(&c));
    c = -1;
    println!("c = {} after modification.", c);

    let z: isize = 123;
    let size_of_z = mem::size_of_val(&z);
    println!(
        "z = {}, takes up {} bytes in the {}-bit OS",
        z,
        size_of_z,
        size_of_z * 8
    );

    let d = 'x';
    println!("d = {}, size = {} bytes.", d, mem::size_of_val(&d));

    // default double precision, 8 bytes or 64 bits, f64
    let e = 2.5;
    println!("e = {}, size = {} bytes.", e, mem::size_of_val(&e));

    let e2: f32 = 2.5;
    println!("e2 = {}, size = {} bytes.", e2, mem::size_of_val(&e2));

    let g = false;
    println!("g = {}, size = {} bytes.", g, mem::size_of_val(&g));

    println!("MEANING_OF_LIFE is {}", MEANING_OF_LIFE);
    println!("ULTRA_MAN is {}", ULTRA_MAN);
}

pub fn basic() {
    println!("--- Basic Start ---");
    fundamental_data_types();
    operators();
    scope_and_shadowing();

    s_h::stack_and_heap();

    control::if_statement(32);
    control::if_statement(25);
    control::if_statement(15);
    control::if_statement(5);

    control::while_loop();

    control::for_loop();

    control::match_statement(44);
    control::match_statement(42);
    control::match_statement(4);
    control::match_statement(144);

    // combination_lock::main();

    enums::enums();

    unions::unions();

    options::options();

    arrays::array();

    slices::slices();

    tuples::tuples();

    pattern_match::pattern_matching();

    generics::generics();

    functions::print_value(42);

    functions::closures();

    let tuple_a: (char, u8, i32) = ('a', 7, 354);
    println!("Size is {}", mem::size_of::<(char, u8, i32)>());
    println!(
        "\"{:?}\" takes up {} bytes with alignment {}.",
        tuple_a,
        mem::size_of_val(&tuple_a),
        mem::align_of::<(char, u8, i32)>()
    );
    println!("--- Basic End ---");

    high_order_functions::accumulated();

    lifetime::show_lifetime();
}
