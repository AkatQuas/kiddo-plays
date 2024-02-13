use std::{
    sync::{Arc, Mutex},
    thread,
};

struct Person {
    name: Arc<String>,
    state: Arc<Mutex<String>>,
}

impl Person {
    fn new(name: Arc<String>, state: Arc<Mutex<String>>) -> Person {
        Person { name, state }
    }

    fn greet(&self) {
        let mut state = self.state.lock().unwrap();

        state.clear();
        state.push_str("excited");

        println!("Hi, my name is {} and I am {}", self.name, state.as_str());
    }
}

pub fn demo() {
    println!("=== Arc");
    let name = Arc::new("iKun".to_string());
    let state = Arc::new(Mutex::new("board".to_string()));
    let person = Person::new(name.clone(), state.clone());

    let t = thread::spawn(move || {
        person.greet();
    });

    println!("Name = {} in {} mood.", name, state.lock().unwrap());

    t.join().unwrap();
    println!("=== Arc END");
}
