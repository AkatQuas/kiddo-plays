use crate::CHUNK_SIZE;
use crossbeam::channel::Sender as cbSender;
use std::fs::File;
use std::io::{self, BufReader, Read, Result};
use std::sync::mpsc::Sender;

pub fn read(input: &Option<String>) -> Result<Vec<u8>> {
    let mut reader: Box<dyn Read> = match input.as_ref() {
        Some(i) => Box::new(BufReader::new(File::open(i)?)),
        None => Box::new(BufReader::new(io::stdin())),
    };

    let mut buffer = [0; CHUNK_SIZE];
    let num_read = reader.read(&mut buffer)?;
    Ok(Vec::from(&buffer[..num_read]))
}

pub fn read_loop(input: &Option<String>, stats_tx: Sender<Vec<u8>>) -> Result<()> {
    let mut reader: Box<dyn Read> = match input.as_ref() {
        Some(i) => Box::new(BufReader::new(File::open(i)?)),
        None => Box::new(BufReader::new(io::stdin())),
    };

    let mut buffer = [0; CHUNK_SIZE];

    // keep reading
    loop {
        let num_read = match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(x) => x,
            Err(_) => break,
        };
        // send buffer to stats_thread
        if stats_tx.send(Vec::from(&buffer[..num_read])).is_err() {
            break;
        };
    }
    // send an empty buffer to the stats_thread
    let _ = stats_tx.send(Vec::new());

    // we're done reading, let's quit
    Ok(())
}

pub fn read_loop_cb(
    input: &Option<String>,
    stats_tx: cbSender<usize>,
    write_tx: cbSender<Vec<u8>>,
) -> Result<()> {
    let mut reader: Box<dyn Read> = match input.as_ref() {
        Some(i) => Box::new(BufReader::new(File::open(i)?)),
        None => Box::new(BufReader::new(io::stdin())),
    };

    let mut buffer = [0; CHUNK_SIZE];

    // keep reading
    loop {
        let num_read = match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(x) => x,
            Err(_) => break,
        };
        // send buffer to stats_thread
        let _ = stats_tx.send(num_read);

        if write_tx.send(Vec::from(&buffer[..num_read])).is_err() {
            break;
        };
    }
    // send an empty buffer to the stats_thread
    let _ = stats_tx.send(0);
    let _ = write_tx.send(Vec::new());

    // we're done reading, let's quit
    Ok(())
}
