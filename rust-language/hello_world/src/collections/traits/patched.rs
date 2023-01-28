trait Summable<T> {
    fn sum(&self) -> T;
}

impl Summable<i32> for Vec<i32> {
    fn sum(&self) -> i32 {
        let mut result = 0;
        for x in self {
            result += *x;
        }
        result
    }
}

pub fn monkey_patch_traits() {
    let a = vec![1, 2, 4];
    println!("Sum of vectors is {}", a.sum());
}
