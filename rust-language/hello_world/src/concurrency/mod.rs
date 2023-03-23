use std::thread;
use std::time;

pub fn concurrency() {
    let handle = thread::spawn(|| {
        for _ in 1..10 {
            println!("in+");
            thread::sleep(time::Duration::from_millis(500));
        }
    });
    for _ in 1..10 {
        println!("out-");
        thread::sleep(time::Duration::from_millis(300));
    }
    handle.join();
}
