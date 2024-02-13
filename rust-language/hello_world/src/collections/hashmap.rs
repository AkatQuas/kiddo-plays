use std::collections::HashMap;
use std::mem;

type Table = HashMap<String, Vec<String>>;

// This would move the value into the function
fn show_by_value(table: Table) {
    for (/* String */ artist, /* Vec<String> */ works) in table {
        println!("Works by {}:", artist);
        for
        /* String */
        work in works {
            println!(" {}", work);
        }
    }
}

// Only pass a reference
fn show_by_ref(table: &Table) {
    for (/* &String */ artist, /* &Vec<String> */ works) in table {
        println!("Works by {}:", artist);
        for
        /* &String */
        work in works {
            println!(" {}", work);
        }
    }
}

pub fn hashmap() {
    let mut shapes = HashMap::new();
    println!(
        "HashMap {:?} takes up {} bytes",
        shapes,
        mem::size_of_val(&shapes)
    );

    shapes.insert(String::from("triangle"), 3);
    shapes.insert(String::from("square"), 4);
    println!(
        "After insertion, HashMap {:?} takes up {} bytes",
        shapes,
        mem::size_of_val(&shapes)
    );

    println!("A Square has {} sides.", shapes["square".into()]);

    shapes.entry("circle".into()).or_insert(1);

    for (key, value) in &shapes {
        println!("{}: {}", key, value);
    }

    let mut table = Table::new();
    table.insert(
        "Gesualdo".to_string(),
        vec![
            "many madrigals".to_string(),
            "Tenebrae Responsoria".to_string(),
        ],
    );
    table.insert(
        "Caravaggio".to_string(),
        vec![
            "The Musicians".to_string(),
            "The Calling of St. Matthew".to_string(),
        ],
    );

    show_by_ref(&table);

    show_by_value(table);
}
