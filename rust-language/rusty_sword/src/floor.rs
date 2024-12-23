use rand::distributions::{Bernoulli, Distribution};

use crate::coord::Coord;

pub struct Floor {
    pub rows: usize,
    pub cols: usize,
    pub tiles: Vec<Vec<&'static str>>,
}

impl Floor {
    pub fn new(rows: usize, cols: usize) -> Self {
        // Tiles to use
        let horizontal = "─"; // U+2500
        let vertical = "│"; // U+2502
        let top_left = "┌"; // U+250c
        let top_right = "┐"; // U+2510
        let bottom_left = "└"; // U+2514
        let bottom_right = "┘"; // U+2518
        let _rock = "#"; // U+0023
        let block = "⊘"; // U+2298
        let blank = " ";

        // Row-major
        let mut tiles = Vec::<Vec<&'static str>>::with_capacity(rows);
        for _ in 0..rows {
            tiles.push(Vec::<&'static str>::with_capacity(cols));
        }

        // First row is all wall
        tiles[0].push(top_left);
        for _ in 1..cols - 1 {
            tiles[0].push(horizontal);
        }
        tiles[0].push(top_right);

        // Middle rows are vertical sides and blank middles
        for row in 1..rows - 1 {
            tiles[row].push(vertical);

            for _ in 1..cols - 1 {
                let d = Bernoulli::new(0.01).unwrap();
                if d.sample(&mut rand::thread_rng()) {
                    tiles[row].push(block);
                } else {
                    tiles[row].push(blank);
                }
            }

            tiles[row].push(vertical);
        }

        // Bottom row is all wall
        tiles[rows - 1].push(bottom_left);
        for _ in 1..cols - 1 {
            tiles[rows - 1].push(horizontal);
        }
        tiles[rows - 1].push(bottom_right);

        Self { rows, cols, tiles }
    }

    pub fn get_symbol(&self, coord: Coord) -> &'static str {
        self.tiles[coord.row][coord.col]
    }
    pub fn is_wall(&self, coord: Coord) -> bool {
        self.tiles[coord.row][coord.col] != " "
    }
}
