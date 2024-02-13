use std::rc::Rc;

struct Person {
    name: Rc<String>,
}

impl Person {
    fn new(name: Rc<String>) -> Person {
        Person { name }
    }

    fn greet(&self) {
        println!("Hi, my name is {}", self.name);
    }
}

pub fn demo() {
    println!("=== Rc");
    let name = Rc::new("iKun".to_string());
    println!(
        "Name = {} with {} strong pointers.",
        name,
        Rc::strong_count(&name)
    );
    assert_eq!(Rc::strong_count(&name), 1);
    {
        let person = Person::new(name.clone());

        person.greet();
        println!(
            "Name = {} with {} strong pointers.",
            name,
            Rc::strong_count(&name)
        );
        assert_eq!(Rc::strong_count(&name), 2);
    }

    println!(
        "Name = {} with {} strong pointers.",
        name,
        Rc::strong_count(&name)
    );
    assert_eq!(Rc::strong_count(&name), 1);
    println!("=== Rc END");
}
