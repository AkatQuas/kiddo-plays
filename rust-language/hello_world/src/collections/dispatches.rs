use std::fmt::Debug;

trait Printable {
    fn format(&self) -> String;
}

impl Printable for i32 {
    fn format(&self) -> String {
        format!("i32: {}", *self)
    }
}

impl Printable for String {
    fn format(&self) -> String {
        format!("string: {}", *self)
    }
}

// z is a pointer reference
// so use dynamic dispatch
fn print_it_dynamic(z: &dyn Printable) {
    println!("dynamic -> {}", z.format());
}

// monomorphization
// see https://doc.rust-lang.org/1.8.0/book/trait-objects.html#static-dispatch
fn print_it_static<T: Printable>(z: T) {
    println!("static  -> {}", z.format());
}

pub fn do_dispatch() {
    {
        let a = 123;
        let b = "hello".to_string();
        println!("normal -> a {}", a.format());
        println!("normal -> b {}", b.format());
    }
    {
        let a = 123;
        let b = "hello".to_string();
        print_it_static(a);
        print_it_static(b);
    }
    {
        let a = 123;
        let b = "hello".to_string();
        print_it_dynamic(&a);
        print_it_dynamic(&b);
    }
}

/* --- */

trait Shape {
    fn area(&self) -> f64;
}

struct Square {
    side: f64,
}

impl Shape for Square {
    fn area(&self) -> f64 {
        self.side * self.side
    }
}

struct Circle {
    radius: f64,
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        self.radius * self.radius * std::f64::consts::PI
    }
}

pub fn loop_dynamic_dispatch() {
    let shapes: [&dyn Shape; 4] = [
        &Circle { radius: 1.0 },
        &Square { side: 3.0 },
        &Circle { radius: 2.0 },
        &Square { side: 4.0 },
    ];

    for (i, shape) in shapes.iter().enumerate() {
        println!("Shape #{} has area {}", i, shape.area());
    }
}

/* --- */

trait Animal {
    fn name(&self) -> &'static str;

    fn talk(&self) {
        println!("{} cannot talk", self.name());
    }
}

#[derive(Debug)]
struct Human {
    name: &'static str,
}

impl Animal for Human {
    fn name(&self) -> &'static str {
        self.name
    }

    fn talk(&self) {
        println!("{} likes to rap and dance.", self.name());
    }
}

#[derive(Debug)]
struct Chicken {
    name: &'static str,
}

impl Animal for Chicken {
    fn name(&self) -> &'static str {
        self.name
    }

    fn talk(&self) {
        println!("{} meows.", self.name());
    }
}

enum Creature {
    Human(Human),
    Chicken(Chicken),
}

pub fn trait_with_dynamic_dispatch() {
    {
        // we have to introduce an enum if not using dynamic dispatch
        let mut creatures = Vec::new();
        creatures.push(Creature::Human(Human { name: "iKun" }));
        creatures.push(Creature::Chicken(Chicken { name: "只因" }));
        println!("== Creatures!");
        for c in creatures {
            match c {
                Creature::Human(h) => h.talk(),
                Creature::Chicken(c) => c.talk(),
            }
        }
        println!("== Creatures End!");
    }

    {
        let mut animals: Vec<Box<dyn Animal>> = Vec::new();
        animals.push(Box::new(Human { name: "iKun" }));
        animals.push(Box::new(Chicken { name: "只因" }));
        println!("== Animals!");
        for a in animals.iter() {
            a.talk();
        }
        println!("== Animals End!");
    }
}
