use crate::{coord::Coord, floor::Floor, monster::Monster, player::Player};

pub struct World {
    pub paused: bool,
    pub floor: Floor,
    pub player: Player,
    pub dirty_coords: Vec<Coord>,
    pub monsters: Vec<Monster>,
}

impl World {
    pub fn new(rows: usize, cols: usize) -> Self {
        Self {
            paused: false,
            floor: Floor::new(rows, cols),
            player: Player::new(Coord::new(rows / 2, cols / 2)),
            dirty_coords: Vec::<Coord>::new(),
            monsters: Vec::<Monster>::new(),
        }
    }
}
