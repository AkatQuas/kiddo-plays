use std::fmt::Debug;

#[derive(Debug)]
struct Person {
    name: String,
}

impl Person {
    fn new(name: &str) -> Self {
        Person {
            name: name.to_string(),
        }
    }

    fn new_into<S: Into<String>>(name: S) -> Self {
        Person { name: name.into() }
    }

    fn new_where<S>(name: S) -> Self
    where
        S: Into<String>,
    {
        Person { name: name.into() }
    }
}

pub fn make_into() {
    let i_kun = Person::new("iKun0");
    println!("{:?} is dancing", i_kun);

    let name: String = "iKun1".to_string();
    let i_kun = Person::new_into(name);
    println!("{:?} is dancing", i_kun);

    let i_kun = Person::new_where("iKun2");
    println!("{:?} is dancing", i_kun);
}
