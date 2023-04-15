use std::{
    io::{self, Stdout},
    time::Duration,
};

use crossbeam::channel::{Receiver, Sender};
use crossterm::{
    cursor::{Hide, MoveTo, Show},
    event::{self, Event, KeyCode},
    style::{style, Color, Stylize},
    terminal::{self, Clear, ClearType, EnterAlternateScreen, LeaveAlternateScreen},
    ExecutableCommand,
};

use crate::{coord::Coord, world::World};

fn goto_coord(stdout: &mut Stdout, coord: Coord) {
    stdout
        .execute(MoveTo(coord.col as u16, coord.row as u16))
        .unwrap();
}

pub fn render_welcome() -> bool {
    let stdout = &mut io::stdout();
    terminal::enable_raw_mode().unwrap();

    stdout.execute(EnterAlternateScreen).unwrap();
    stdout.execute(Clear(ClearType::All)).unwrap();

    let infos = vec![
        "Information!",
        "- The `⦲` represents you, and the arrow symbol next to you is your rusty sword.",
        "- Use arrow keys or `WASD` keys to move. Your sword will always point in the direction you are moving. (You are not particularly skilled at swordfighting, apparently).",
        "- Monsters will attempt to eat you. If they touch you, your HP decreases. They will succeed and the game will be over if your HP reaches 0.",
        "- Neither you or monster could move across the block part `⊘` .",
        "- Touching a monster with your rusty sword will instantly kill it (naturally, since monsters are unsafe).",
        "- Scores are different for each monster. Gain as much as you can.",
        "- Have fun!",
        "Press any key to continue",
        ""
    ];
    for (i, info) in infos.iter().enumerate() {
        goto_coord(stdout, Coord::new(i, 0));
        print!("{}", info);
    }

    'info: loop {
        while event::poll(Duration::default()).unwrap() {
            let an_event = event::read().unwrap();
            if let Event::Key(key_event) = an_event {
                if (key_event.code == KeyCode::Char('q')) | (key_event.code == KeyCode::Esc) {
                    return false;
                }
                break 'info;
            }
        }
    }

    stdout.execute(LeaveAlternateScreen).unwrap();
    terminal::disable_raw_mode().unwrap();
    return true;
}

pub fn render_game_loop(world_rx: Receiver<World>, main_tx: Sender<World>) {
    let stdout = &mut io::stdout();

    stdout.execute(Hide).unwrap();

    // Draw the entire floor - we only have to do this once
    let mut world = world_rx.recv().unwrap();
    let game_title_coord = Coord::new(world.floor.rows, 0);
    goto_coord(stdout, Coord::new(0, 0));

    {
        let tiles = &world.floor.tiles;
        for row in tiles {
            for tile in row {
                print!("{}", tile);
            }
            print!("\r\n");
        }
    }

    main_tx.send(world).unwrap();

    loop {
        world = match world_rx.recv() {
            Ok(w) => w,
            Err(_) => {
                break;
            }
        };

        // Re-draw any dirty coordinates with floor tiles
        for coord in world.dirty_coords.drain(..) {
            goto_coord(stdout, coord);
            print!("{}", world.floor.get_symbol(coord));
        }

        // Render Player
        let player = &mut world.player;
        if player.dirty {
            player.dirty = false;

            // Sword
            goto_coord(stdout, player.sword_coord);
            print!("{}", style(player.sword_symbol()).with(Color::Red));

            // Player
            goto_coord(stdout, player.coord);
            print!("{}", style(&player.symbol).with(Color::Blue));
        }

        // Player score and HP
        let score_string = format!("Score: {}, HP: {}", player.score, player.hp);

        goto_coord(
            stdout,
            Coord::new(world.floor.rows, world.floor.cols - score_string.len()),
        );
        print!("{}", style(score_string).with(Color::Cyan));

        // Monsters
        let monsters = &mut world.monsters;
        for monster in monsters.iter() {
            goto_coord(stdout, monster.coord);
            print!("{}", style(&monster.symbol).with(Color::DarkYellow));
        }

        // Game Title
        goto_coord(stdout, game_title_coord);
        let pause_string = if world.paused { "[Paused]" } else { "        " };
        print!(
            "{}{}",
            style("Rusty Sword - Game of Infamy!").with(Color::White),
            style(pause_string).with(Color::White),
        );

        if main_tx.send(world).is_err() {
            break;
        }
    }

    // cleanup
    stdout.execute(Show).unwrap();
}

pub fn render_goodbye() {
    let stdout = &mut io::stdout();
    stdout.execute(Clear(ClearType::All)).unwrap();

    goto_coord(stdout, Coord::new(0, 0));
    print!("Thanks for playing, see you next time~");
}
