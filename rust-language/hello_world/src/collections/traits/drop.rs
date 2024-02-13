#[warn(unused_mut)]

struct Creature {
    name: String,
}

impl Creature {
    fn new(name: &str) -> Self {
        println!("{} enters the game", name);
        Creature { name: name.into() }
    }
}

impl Drop for Creature {
    fn drop(&mut self) {
        println!("{} is dead", self.name);
    }
}

pub fn make_drops() {
    let i_kun = Creature::new("iKun");
    println!("game is closing");
    // drop would be called when the variable is destructed.

    // or explicitly invoke the drop function.
    // drop(i_kun);
    //
    // i_kun is no longer available

    let ji_yin: Creature;
    println!("Before scope.");

    {
        let i_kun2 = Creature::new("iKun2");
        let i_kun3 = Creature::new("iKun3");
        println!("game is proceeding");
        ji_yin = i_kun2;
        println!("game is closing");
    }

    println!("After scope. {}", ji_yin.name);
}
