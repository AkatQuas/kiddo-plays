use std::mem;

fn use_slice(slice: &mut [i32]) {
    println!("First element = {}, len = {}", slice[0], slice.len());
    println!("Slice takes up {} bytes", mem::size_of_val(&slice));
    slice[0] = 4321;
}

pub fn slices() {
    let mut data = [1, 2, 3, 4, 5];
    use_slice(&mut data[1..4]);
    println!("{:?}", data);
    use_slice(&mut data);
    println!("{:?}", data);
}
