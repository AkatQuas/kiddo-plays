import 'dart:isolate';

void funk(var message) {
  print("from funk");
}

void topLevel(var msg) {
  print("anonymous, $msg");
}

main(List<String> args) {
  Isolate.spawn(funk, null);
  print("from main");
  Isolate.spawn(topLevel, "random");
}
