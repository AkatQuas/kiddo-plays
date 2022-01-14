use std::error;
use std::fmt;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

enum Message {
  NewJob(Job),
  Terminate,
}

#[derive(PartialEq, Debug)]
pub enum PoolCreationError {
  PositiveSize,
}

impl fmt::Display for PoolCreationError {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    let description = match *self {
      PoolCreationError::PositiveSize => "Pool size should be positive.",
    };
    f.write_str(description)
  }
}

impl error::Error for PoolCreationError {}

/// `ThreadPool` hold several workers to do dirty work.
///
/// `ThreadPool` hold a sender channel to send `Job`.
pub struct ThreadPool {
  workers: Vec<Worker>,
  sender: mpsc::Sender<Message>,
}

impl ThreadPool {
  /// Create a new ThreadPool.
  ///
  /// The size is the number of threads in the pool.
  ///
  /// # Panics
  ///
  /// The `new` function will panic if the size is zero.
  pub fn new(size: usize) -> Result<ThreadPool, PoolCreationError> {
    if size <= 0 {
      return Err(PoolCreationError::PositiveSize);
    }
    let mut workers = Vec::with_capacity(size);
    let (sender, receiver) = mpsc::channel();
    // Taking a job off the channel queue involves mutating the `receiver`
    let receiver = Arc::new(Mutex::new(receiver));

    for id in 0..size {
      // create some threads and store them in the vector
      workers.push(Worker::new(id, Arc::clone(&receiver)));
    }

    Ok(ThreadPool { workers, sender })
  }

  /// The `F` type parameter also has the trait bound `Send` and the lifetime bound `'static`.
  ///
  /// We need `Send` to transfer the closure from one thread to another and `'static` because we don’t know how long the thread will take to execute.
  pub fn execute<F>(&self, f: F)
  where
    F: FnOnce() + Send + 'static,
  {
    let job = Box::new(f);
    self.sender.send(Message::NewJob(job)).unwrap();
  }
}

impl Drop for ThreadPool {
  fn drop(&mut self) {
    println!("Sending terminate message to all workers.");
    for _ in &self.workers {
      self.sender.send(Message::Terminate).unwrap();
    }

    println!("Shutting down all workers");

    for worker in &mut self.workers {
      // `join` will take ownership of its argument (thread)
      // so Worker.thread lost its references
      // Make it to be `Option`, after `take()`, a `None` would fill it
      if let Some(thread) = worker.thread.take() {
        println!("Shutting down worker.[id={}]", worker.id);
        thread.join().unwrap();
      }
    }
  }
}

/// `Worker` will execute `Job` from `receiver` in the first-created Closure.
///
/// Each `Worker` will store a single `JoinHandle<()>`
///
struct Worker {
  id: usize,
  thread: Option<thread::JoinHandle<()>>,
}

impl Worker {
  fn new(id: usize, receiver: Arc<Mutex<mpsc::Receiver<Message>>>) -> Worker {
    // infinite loop closure
    // `recv()` will wait for `Job`
    let thread = thread::spawn(move || loop {
      // `lock()` to acquire the mutex, so only one thread at a time can request a job.
      // `recv()` to consume the job
      let message = receiver.lock().unwrap().recv().unwrap();
      match message {
        Message::NewJob(job) => {
          println!("Worker got a job; executing.[id={}]", id);
          job();
        }
        Message::Terminate => {
          println!("Worker told to terminate.[id={}]", id);
          break;
        }
      }
    });
    Worker {
      id,
      thread: Some(thread),
    }
  }
}

type Job = Box<dyn FnOnce() + Send + 'static>;
