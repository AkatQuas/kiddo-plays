use crossbeam::channel::Receiver as cbReceiver;
use std::fs::File;
use std::io::{self, BufWriter, ErrorKind, Result, Write};
use std::sync::mpsc::Receiver;

pub fn write(output: &Option<String>, buffer: &[u8]) -> Result<bool> {
    let mut writer: Box<dyn Write> = match output.as_ref() {
        Some(o) => Box::new(BufWriter::new(File::create(o)?)),
        None => Box::new(BufWriter::new(io::stdout())),
    };
    if let Err(e) = writer.write_all(buffer) {
        if e.kind() == ErrorKind::BrokenPipe {
            // false means "stop the program cleanly"
            return Ok(false);
        }
        return Err(e);
    }
    // true means "keep going"
    Ok(true)
}

pub fn write_loop(output: &Option<String>, write_rx: Receiver<Vec<u8>>) -> Result<()> {
    let mut writer: Box<dyn Write> = match output.as_ref() {
        Some(o) => Box::new(BufWriter::new(File::create(o)?)),
        None => Box::new(BufWriter::new(io::stdout())),
    };
    loop {
        // receive vector from stats_thread
        let buffer = write_rx.recv().unwrap();
        if buffer.is_empty() {
            break;
        }

        if let Err(e) = writer.write_all(&buffer) {
            if e.kind() == ErrorKind::BrokenPipe {
                // false means "stop the program cleanly"
                return Ok(());
            }
            return Err(e);
        }
    }
    // true means "keep going"

    Ok(())
}

pub fn write_loop_cb(output: &Option<String>, write_rx: cbReceiver<Vec<u8>>) -> Result<()> {
    let mut writer: Box<dyn Write> = match output.as_ref() {
        Some(o) => Box::new(BufWriter::new(File::create(o)?)),
        None => Box::new(BufWriter::new(io::stdout())),
    };
    loop {
        // receive vector from stats_thread
        let buffer = write_rx.recv().unwrap();
        if buffer.is_empty() {
            break;
        }

        if let Err(e) = writer.write_all(&buffer) {
            if e.kind() == ErrorKind::BrokenPipe {
                // false means "stop the program cleanly"
                return Ok(());
            }
            return Err(e);
        }
    }
    // true means "keep going"

    Ok(())
}
