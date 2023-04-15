use crate::{
    coord::{Coord, Direction},
    floor::Floor,
};

pub struct Player {
    pub coord: Coord,
    pub facing: Direction,
    pub sword_coord: Coord,
    pub symbol: &'static str,
    pub dirty: bool,
    pub score: u64,
    pub hp: u64,
}

impl Player {
    pub fn new(coord: Coord) -> Self {
        Self {
            coord,
            facing: Direction::Right,
            sword_coord: coord.to_the(Direction::Right),
            symbol: "⦲", // U+29B2
            // symbol: "☥", // U+2625
            dirty: true,
            score: 0,
            hp: 3,
        }
    }

    pub fn sword_symbol(&self) -> &'static str {
        match self.facing {
            Direction::Up => "⤧",    // U+2927
            Direction::Down => "⤩",  // U+2929
            Direction::Left => "⤪",  // U+292A
            Direction::Right => "⤨", // U+2928
        }
    }

    pub fn travel(
        &mut self,
        direction: Direction,
        floor: &Floor,
        dirty_coords: &mut Vec<Coord>,
    ) -> bool {
        let mut moved = false;
        // Do player change direction ?
        if self.facing != direction {
            self.dirty = true;
            dirty_coords.push(self.sword_coord);
            self.facing = direction;
        } else {
            // May player move ?
            let to_coord = self.coord.to_the(self.facing);
            if !floor.is_wall(to_coord) {
                self.dirty = true;
                moved = true;
                dirty_coords.push(self.coord);
                dirty_coords.push(self.sword_coord);
                self.coord = to_coord;
            }
        }

        // Update the sword's position
        self.sword_coord = self.coord.to_the(self.facing);

        moved
    }
}
