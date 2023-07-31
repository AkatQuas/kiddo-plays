extern crate glutin_window;
extern crate graphics;
extern crate opengl_graphics;
extern crate piston;

use glutin_window::GlutinWindow as Window;
use opengl_graphics::{GlGraphics, OpenGL};
use piston::{
    Button, EventSettings, Events, PressEvent, RenderArgs, RenderEvent, UpdateArgs, UpdateEvent,
    WindowSettings,
};

pub struct Game {
    gl: GlGraphics, // OpenGL drawing backend.
    speed: f64,
    rotation: f64, //  Rotation for the square
}

impl Game {
    fn render(&mut self, args: &RenderArgs) {
        use graphics::*;
        const GREEN: [f32; 4] = [0.0, 1.0, 0.0, 1.0];
        const RED: [f32; 4] = [1.0, 0.0, 0.0, 1.0];

        let square = rectangle::square(0.0, 0.0, 50.0);
        let rotation = self.rotation;

        let (x, y) = (args.window_size[0] / 2.0, args.window_size[1] / 2.0);

        self.gl.draw(args.viewport(), |c, gl| {
            // Clear the screen
            clear(GREEN, gl);
            let transform = c
                .transform
                .trans(x, y)
                .rot_rad(rotation)
                .trans(-25.0, -25.0);

            rectangle(RED, square, transform, gl);
        });
    }

    fn update(&mut self, args: &UpdateArgs) {
        // Rotate 2 radians per second
        self.rotation += self.speed * args.dt;
        println!("current rotation {}", self.rotation);
    }

    fn key_press(&mut self, args: &Button) {
        use piston_window::{Button::Keyboard, Key};
        if *args == Keyboard(Key::Up) {
            self.speed += 1.0;
            if self.speed > 5.0 {
                println!("Fastest speed is 5.0");
                self.speed = 5.0;
            }
        }

        if *args == Keyboard(Key::Down) {
            self.speed -= 1.0;
            if self.speed < 1.0 {
                println!("Slowest speed is 1.0");
                self.speed = 1.0;
            }
        }
    }
}

fn main() {
    // Change this to OpenGL::V2_1 if not working;
    let opengl = OpenGL::V3_2;

    // Create a Glutin window.
    let mut window: Window = WindowSettings::new("Spin Square", [200, 200])
        .graphics_api(opengl)
        .exit_on_esc(true)
        .build()
        .unwrap();

    //  Create a new gam and run it.
    let mut game = Game {
        gl: GlGraphics::new(opengl),
        rotation: 0.0,
        speed: 2.0,
    };

    let mut events = Events::new(EventSettings::new());
    while let Some(e) = events.next(&mut window) {
        if let Some(args) = e.render_args() {
            game.render(&args);
        }

        if let Some(args) = e.update_args() {
            game.update(&args);
        }

        if let Some(ref args) = e.press_args() {
            game.key_press(args);
        }
    }
}
