import 'dart:io';

void main() {
  stdout.writeln('hello user');

  while (true) {
    stdout.write("\$ -> ");
    String input = stdin.readLineSync()?.trim();
    if (input == 'exit') {
      break;
    }
    stdout.writeln(input);
  }
  stdout.writeln('bye');
}
