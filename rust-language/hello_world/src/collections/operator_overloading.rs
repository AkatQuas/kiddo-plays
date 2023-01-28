use std::fmt::Debug;

use std::cmp::PartialEq;
use std::ops::{Add, AddAssign, Neg};

#[derive(Debug)]
struct Complex<T> {
    re: T,
    im: T,
}

impl<T> Complex<T> {
    fn new(re: T, im: T) -> Complex<T> {
        Complex::<T> { re, im }
    }
}

impl<T> Add for Complex<T>
where
    T: Add<Output = T>,
{
    type Output = Complex<T>;

    //      a   +  b
    fn add(self, rhs: Self) -> Self::Output {
        // unimplemented!();
        Complex {
            re: self.re + rhs.re,
            im: self.im + rhs.im,
        }
    }
}

impl<T> AddAssign for Complex<T>
where
    T: AddAssign<T>,
{
    fn add_assign(&mut self, rhs: Self) {
        self.re += rhs.re;
        self.im += rhs.im;
    }
}

impl<T> Neg for Complex<T>
where
    T: Neg<Output = T>,
{
    type Output = Complex<T>;
    fn neg(self) -> Self::Output {
        Complex {
            re: -self.re,
            im: -self.im,
        }
    }
}

impl<T> PartialEq for Complex<T>
where
    T: PartialEq,
{
    fn eq(&self, rhs: &Self) -> bool {
        self.re == rhs.re && self.im == rhs.im
    }
}

pub fn overloading() {
    {
        let a = Complex::new(1, 2);
        let b = Complex::new(3, 4);

        println!("a is {:?}, b is {:?}", a, b);
    }

    {
        let a = Complex::new(1, 2);

        println!("-a is {:?}", -a);
    }

    {
        let a = Complex::new(1.1, 2.0);
        let b = Complex::new(3.2, 4.0);

        println!("a+b is {:?}", a + b);
    }
    {
        let a = Complex::new(1.1, 2.0);
        let b = Complex::new(3.2, 4.0);

        println!("a+b is {:?}", a + b);
    }
    {
        let a = Complex::new(1.1, 2.0);
        let b = Complex::new(3.2, 4.0);

        println!("a == b is {}", a == b);
    }
    {
        let mut a = Complex::new(1.3, 2.0);
        let b = Complex::new(3.4, 4.0);

        a += b;
        println!("after `a += b`, a is {:?}", a);
    }
}
