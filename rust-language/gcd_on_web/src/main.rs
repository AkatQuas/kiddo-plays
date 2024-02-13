use actix_web::{web, App, HttpServer};

mod app_data;
mod service;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .app_data(web::Data::new(app_data::AppState::new("GCD Web")))
            .service(service::index)
            .service(service::hello)
            .service(service::gcd_index)
            .service(service::gcd_form)
    })
    .workers(4)
    .bind(("127.0.0.1", 4300))?
    .run()
    .await
}
