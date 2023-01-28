use std::fmt::Debug;

trait Animal {
    // this is a static method
    fn create(name: &'static str) -> Self;

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
    fn create(name: &'static str) -> Human {
        Human { name }
    }
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
    fn create(name: &'static str) -> Chicken {
        Chicken { name }
    }
    fn name(&self) -> &'static str {
        self.name
    }

    fn talk(&self) {
        println!("{} meows.", self.name());
    }
}

pub fn basic_traits() {
    let h = Human { name: "iKun-1" };
    println!("【{:?}】 has the name \"{}\".", h, h.name());
    h.talk();

    let h2 = Human::create("iKun-2");
    println!("【{:?}】 has the name \"{}\".", h2, h2.name());
    h2.talk();

    let h3: Human = Animal::create("iKun-3");
    println!("【{:?}】 has the name \"{}\".", h3, h3.name());
    h3.talk();

    let c = Chicken { name: "只因" };
    c.talk();
}
