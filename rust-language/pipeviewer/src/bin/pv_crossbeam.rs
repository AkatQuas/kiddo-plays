use crossbeam::channel::{bounded, unbounded};
use pipeviewer::{args::Args, read, stats, write};
use std::io::Result;
use std::thread;

fn main() -> Result<()> {
    let args = Args::parse_n_patch();
    // dbg!(args);

    // transmit_to_channel, receive_from_channel
    let (stats_tx, stats_rx) = unbounded();
    let (write_tx, write_rx) = bounded(1024);

    let read_handle = thread::spawn(move || read::read_loop_cb(&args.input, stats_tx, write_tx));
    let stats_handle = thread::spawn(move || stats::stats_loop_cb(args.silent, stats_rx));
    let write_handle = thread::spawn(move || write::write_loop_cb(&args.output, write_rx));

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
