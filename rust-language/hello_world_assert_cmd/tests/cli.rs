use assert_cmd::Command;

#[test]
fn hello_world() {
    let mut cmd = Command::cargo_bin("hello").unwrap();
    cmd.assert().success().stdout("Hello, world!\n");
}

#[test]
fn command_exit_0() {
    let mut cmd = Command::cargo_bin("true").unwrap();
    cmd.assert().success();
}

#[test]
fn command_exit_with_fail() {
    let mut cmd = Command::cargo_bin("false").unwrap();
    cmd.assert().failure();
}

#[test]
fn command_exit_with_panic() {
    let mut cmd = Command::cargo_bin("panic").unwrap();
    cmd.assert().failure();
}

#[test]
fn false_not_exist() {
    if let Ok(_) = Command::cargo_bin("non_existent_command") {
        panic!("This command should not exist");
    } else {
        assert!(true);
    }
}
