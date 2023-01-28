use std::collections::HashSet;
use std::mem;

pub fn hashset() {
    let mut greeks = HashSet::new();
    greeks.insert("gamma");
    greeks.insert("delta");
    println!(
        "HashSet {:?} takes up {} bytes",
        greeks,
        mem::size_of_val(&greeks)
    );

    let added_vega = greeks.insert("vega");
    if added_vega {
        println!("Added Vega {:?}", added_vega);
    }
    let added_gamma = greeks.insert("gamma");
    if added_gamma {
        // println!("Added Vega {:?}", added_vega);
    } else {
        println!("Failed to add gamma");
    }

    if greeks.contains("kappa") {
        println!("We have kappa.");
    } else {
        println!("We don't have kappa.");
    }

    let removed = greeks.remove("delta");
    if removed {
        println!("Removed delta, {}", removed);
    }

    let _1_5: HashSet<_> = (1..=5).collect();
    let _6_10: HashSet<_> = (6..=10).collect();
    let _1_10: HashSet<_> = (1..=10).collect();
    let _2_8: HashSet<_> = (2..=8).collect();

    // subset
    println!(
        "is {:?} a subset of {:?}? {}",
        _6_10,
        _1_10,
        _6_10.is_subset(&_1_10)
    );
    println!(
        "is {:?} a subset of {:?}? {}",
        _2_8,
        _1_10,
        _2_8.is_subset(&_1_10)
    );

    // disjoint = no common elements
    println!(
        "{:?} disjoint with {:?} is {:?}",
        _1_5,
        _6_10,
        _1_5.is_disjoint(&_6_10)
    );

    // union, intersection
    println!(
        "items in either {:?} or {:?} is {:?}",
        _2_8,
        _6_10,
        _2_8.union(&_6_10)
    );

    // difference =
    println!(
        "items in {:?} but not in {:?} is {:?}",
        _2_8,
        _6_10,
        _2_8.difference(&_6_10)
    );
    println!(
        "items in {:?} but not in {:?} is {:?}",
        _6_10,
        _2_8,
        _6_10.difference(&_2_8)
    );
}
