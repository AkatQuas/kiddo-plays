struct Person {
    name: String,
}

impl Person {
    fn get_name_ref<'a>(&'a self) -> &'a String {
        &self.name
    }
}

struct Company<'z> {
    name: String,
    ceo: &'z Person,
}

struct People<'a> {
    name: &'a str,
}

impl<'b> People<'b> {
    fn talk(&self) {
        println!("Hi, my name is {}", self.name);
    }
}

pub fn show_lifetime() {
    let i_kun = Person {
        name: String::from("iKun"),
    };
    let company = Company {
        name: String::from("R&B"),
        ceo: &i_kun,
    };

    let mut z: &String;

    {
        let p = Person {
            name: String::from("iKun"),
        };
        z = p.get_name_ref();
    }

    {
        let p = People { name: "iKun" };
        p.talk();
    }
}
