fn is_even(x: u32) -> bool {
    x % 2 == 0
}

fn greater_than(limit: u32) -> impl Fn(u32) -> bool {
    move |y| y > limit
}

pub fn accumulated() {
    // sum of all even squares < 500

    let limit = 500;

    let above_limit = greater_than(limit);
    println!("We still have the variable \"limit\" {}", limit);

    let mut sum = 0;

    for i in 0.. {
        let isq = i * i;

        // if isq > limit { // the plain way
        if above_limit(isq) {
            // using closure
            break;
        } else if is_even(isq) {
            sum += isq;
        }
    }

    println!("[Loop]Sum is {}", sum);

    let sum2 = (0..)
        .map(|x| x * x)
        .take_while(|&x| x < limit)
        .filter(|x: &u32| is_even(*x))
        .fold(0, |acc, x| acc + x);

    println!("[High order functions] Sum is {}", sum2);
}
