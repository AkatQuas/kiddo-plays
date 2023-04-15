use rand::{
    distributions::Uniform,
    prelude::{Distribution, IteratorRandom},
    rngs::ThreadRng,
};

use crate::{coord::Coord, floor::Floor, timer::Timer};

pub struct Monster {
    pub coord: Coord,
    pub symbol: &'static str,
    pub move_timer: Timer,
    pub score: u64,
}

const MONSTER_SYMBOLS: [&str; 5] = [
    "☨", // U-2628
    "♄", // U-2644
    "⟟", // U-27df
    "⟠", // U-27e0
    "⫳", // U-2af3
];

impl Monster {
    pub fn new(coord: Coord, rng: &mut ThreadRng) -> Self {
        Self {
            coord,
            score: Uniform::new(10, 50).sample(rng),
            symbol: MONSTER_SYMBOLS.iter().choose(rng).unwrap(),
            move_timer: Timer::from_millis(Uniform::new(200, 1200).sample(rng)),
        }
    }

    pub fn try_travel(&mut self, target: Coord, floor: &Floor, dirty_coords: &mut Vec<Coord>) {
        if !self.move_timer.ready {
            return;
        }

        self.move_timer.reset();
        // May monster move across the block ?
        let to_coord = self.coord.to(target);
        if !floor.is_wall(to_coord) {
            dirty_coords.push(self.coord);
            self.coord = to_coord;
        }
    }
}
