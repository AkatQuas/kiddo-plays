fn calculate(x: f64, y: f64) -> Option<f64> {
    if y == 0.0 {
        None
    } else {
        Some(x / y)
    }
}
pub fn options() {
    let x = 3.0;
    let mut y = 0.0;

    // Option -> Some(T) | None
    let result = calculate(x, y);

    match result {
        Some(v) => {
            println!("Some value {}", v);
        }
        None => println!("Error: Divide by zero."),
    }
    y = 1.0;

    println!("Change y to {}", y);
    let result = calculate(x, y);
    if let Some(z) = result {
        println!("Some value {}", z);
    } else {
        println!("Error: Divide by zero.")
    }
}
