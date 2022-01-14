use hello_tcp::ThreadPool;
use std::fs;
use std::io::prelude::*;
use std::net::TcpListener;
use std::net::TcpStream;
use std::thread;
use std::time::Duration;

fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").unwrap();
    let pool = ThreadPool::new(4).unwrap();
    for stream in listener.incoming().take(2) {
        let stream = stream.unwrap();
        pool.execute(|| {
            handle_connection(stream);
        });
    }
    println!("Shutting down.");
}

fn handle_connection(mut stream: TcpStream) {
    let mut buffer = [0; 1024];
    stream.read(&mut buffer).unwrap();

    println!(
        "Got request. [buffer={}]",
        String::from_utf8_lossy(&buffer[..])
    );

    // byte string
    let get = b"GET / HTTP/1.1\r\n";
    let sleep = b"GET /sleep HTTP/1.1\r\n";

    let (status_line, filename) = if buffer.starts_with(get) {
        ("HTTP/1.1 200 OK", "public/hello.html")
    } else if buffer.starts_with(sleep) {
        thread::sleep(Duration::from_secs(2));
        ("HTTP/1.1 200 OK", "public/hello.html")
    } else {
        ("HTTP/1.1 404 NOT FOUND", "public/404.html")
    };
    let content = read_html(filename);
    let response = format!(
        "{}\r\nContent-Length:{}\r\n\r\n{}",
        status_line,
        content.len(),
        content,
    );

    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}

fn read_html(filename: &str) -> String {
    // relative path to process.cwd
    fs::read_to_string(filename).unwrap()
}
