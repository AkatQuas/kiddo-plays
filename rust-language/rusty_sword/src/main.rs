use crossbeam::channel::bounded;
use crossterm::{
    event::{self, Event, KeyCode},
    terminal::{self, EnterAlternateScreen, LeaveAlternateScreen},
    ExecutableCommand,
};
use rand::{distributions::Uniform, prelude::Distribution};
use rusty_audio::Audio;
use rusty_sword::{
    coord::{key_to_direction, Coord},
    monster::Monster,
    render::{render_game_loop, render_goodbye, render_welcome},
    timer::Timer,
    world::World,
};
use std::{
    io, thread,
    time::{Duration, Instant},
};

fn main() {
    let should_play = render_welcome();
    if should_play {
        game();
    }
    render_goodbye();
}

fn game() {
    let mut audio = Audio::new();
    audio.add("monster_dies", "sounds/monster_dies.wav");
    audio.add("monster_spawns", "sounds/monster_spawns.wav");
    audio.add("player_hurts", "sounds/player_hurts.wav");
    audio.add("player_dies", "sounds/player_dies.wav");

    let mut world = World::new(40, 60);

    // Make a channel to send the world the render thread, and a channel to receive it back
    // This is a silly design, but it demonstrates using channels for thread communication.

    let (render_tx, render_rx) = bounded::<World>(0);
    let (main_tx, main_rx) = bounded::<World>(0);

    // Render Thread
    let render_thread = { thread::spawn(move || render_game_loop(render_rx, main_tx)) };

    // Game Loop

    let mut stdout = io::stdout();
    terminal::enable_raw_mode().unwrap();
    stdout.execute(EnterAlternateScreen).unwrap();

    let mut rng = rand::thread_rng();
    let mut spawn_timer = Timer::from_millis(2000);
    let mut last_instant = Instant::now();

    'gameloop: loop {
        let mut player = &mut world.player;

        // Player moves ?
        let mut player_moved = false;
        while event::poll(Duration::default()).unwrap() {
            let an_event = event::read().unwrap();
            if let Event::Key(key_event) = an_event {
                if (key_event.code == KeyCode::Char('q')) | (key_event.code == KeyCode::Esc) {
                    break 'gameloop;
                } else if key_event.code == KeyCode::Char('p') {
                    world.paused = !world.paused;
                } else if let Some(direction) = key_to_direction(key_event) {
                    player_moved = player.travel(direction, &world.floor, &mut world.dirty_coords);
                }
            }
        }

        if world.paused {
            last_instant = Instant::now();
            // Give the whole world to the renderer
            render_tx.send(world).unwrap();

            // Get the whole world back
            world = main_rx.recv().unwrap();
            continue 'gameloop;
        }

        let delta = last_instant.elapsed();
        last_instant = Instant::now();

        // Update monster timers
        for monster in world.monsters.iter_mut() {
            monster.move_timer.update(delta);
        }

        // Monster move?
        if !player_moved {
            for monster in world.monsters.iter_mut() {
                monster.try_travel(player.coord, &world.floor, &mut world.dirty_coords);
            }
        }

        // Did a monster die?
        let (killed_monsters, retained_monsters) = world
            .monsters
            .into_iter()
            .partition(|m| m.coord == player.sword_coord);

        world.monsters = retained_monsters;

        if killed_monsters.len() > 0 {
            killed_monsters
                .iter()
                .for_each(|m| player.score += m.score as u64);
            audio.play("monster_dies");
        }

        // Spawn a new monster
        spawn_timer.update(delta);
        if spawn_timer.ready {
            spawn_timer = Timer::from_millis(Uniform::new(1000, 5000).sample(&mut rng));
            let spawn_coord = Coord::new(
                Uniform::new(1, world.floor.rows - 1).sample(&mut rng),
                Uniform::new(1, world.floor.cols - 1).sample(&mut rng),
            );
            if spawn_coord != player.coord && spawn_coord != player.sword_coord {
                world.monsters.push(Monster::new(spawn_coord, &mut rng));
                audio.play("monster_spawns");
            }
        }

        // Did the player die?
        if world.monsters.iter().any(|m| m.coord == player.coord) {
            world.monsters = world
                .monsters
                .into_iter()
                .filter(|m| m.coord != player.coord)
                .collect();

            player.hp -= 1;
            if player.hp > 0 {
                audio.play("player_hurts");
            } else {
                audio.play("player_dies");
                audio.wait(); // Wait until the sound finishes, so we can hear it before quitting.
                break 'gameloop;
            }
        }

        // Give the whole world to the renderer
        render_tx.send(world).unwrap();

        // Get the whole world back
        world = main_rx.recv().unwrap();

        // Don't exceed ~60/fps
        if let Some(t) = Duration::from_secs_f64(1. / 60.).checked_sub(last_instant.elapsed()) {
            thread::sleep(t);
        }
    }

    // Close the render_rx channel, which will trigger the render thread to exit
    drop(render_tx);

    // Wait for the render thread to actually exit
    render_thread.join().unwrap();

    stdout.execute(LeaveAlternateScreen).unwrap();
    terminal::disable_raw_mode().unwrap();
}
