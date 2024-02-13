use actix_web::{get, post, web, HttpResponse, Responder};

use crate::{app_data::AppState, utils::gcd};
use serde::Deserialize;

#[get("/")]
async fn index(data: web::Data<AppState>) -> impl Responder {
    let app_name = &data.app_name; // <- get app_name
    let last_calculation = data.last_calculation.lock().unwrap();
    let (n, m, gcd) = last_calculation.release();
    format!("Hello, 42! This is {}!\n1. You can visit '/gcd' for GCD compute.\n2. Visit '/hello/{{name}}' for custom greeting.\n3. Last Calculation for ({}, {}) is {}.", app_name, n, m, gcd)
}

#[get("/gcd")]
async fn gcd_index() -> HttpResponse {
    HttpResponse::Ok().content_type("text/html").body(
        r#"<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>GCD Calculator</title>
          </head>
          <body>
            <form
              action="/gcd"
              method="post"
              style="
                width: 200px;
                margin: 10px auto;
                display: flex;
                flex-direction: column;
              "
            >
              <label for="n">n: </label>
              <input type="text" name="n" />
              <label for="n">m: </label>
              <input type="text" name="m" />
              <button type="submit" style="margin-top: 10px">Compute GCD</button>
            </form>
          </body>
        </html>"#,
    )
}

#[derive(Deserialize)]
struct GCDFormData {
    n: u64,
    m: u64,
}

#[post("/gcd")]
async fn gcd_form(form: web::Form<GCDFormData>, data: web::Data<AppState>) -> HttpResponse {
    if form.n == 0 || form.m == 0 {
        return HttpResponse::BadRequest()
            .content_type("text/html")
            .body("Computing the GCD with zero is boring");
    }
    let gcd_value = gcd(form.n, form.m);

    data.last_calculation
        .lock()
        .unwrap()
        .update(form.n, form.m, gcd_value);
    let response = format!(
        "The greatest common divisor of the number {} and {} is <b>{}</b>.\n",
        form.n, form.m, gcd_value
    );
    HttpResponse::Ok().content_type("text/html").body(response)
}

#[get("/hello/{name}")]
async fn hello(name: web::Path<String>) -> impl Responder {
    format!("Hello {}!", &name)
}
