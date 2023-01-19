mod app;

use app::App;

fn main() {
    println!("Hello, world!");
    yew::start_app::<App>();
}
