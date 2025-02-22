use pipeviewer::{args::Args, read, stats, write};
use std::io::Result;
use std::sync::mpsc;
use std::thread;

fn main() -> Result<()> {
    let args = Args::parse_n_patch();
    // dbg!(args);

    // transmit_to_channel, receive_from_channel
    let (stats_tx, stats_rx) = mpsc::channel();
    let (write_tx, write_rx) = mpsc::channel();

    let read_handle = thread::spawn(move || read::read_loop(&args.input, stats_tx));
    let stats_handle = thread::spawn(move || stats::stats_loop(args.silent, stats_rx, write_tx));
    let write_handle = thread::spawn(move || write::write_loop(&args.output, write_rx));

    // crash if any threads have crashed
    // `.join()` returns a `thread::Result<io::Result<()>>`
    let read_io_result = read_handle.join().unwrap();
    let stats_io_result = stats_handle.join().unwrap();
    let write_io_result = write_handle.join().unwrap();

    // Return an error if any threads returned an error
    read_io_result?;
    stats_io_result?;
    write_io_result?;
    Ok(())
}
