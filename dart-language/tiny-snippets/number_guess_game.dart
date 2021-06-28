import 'dart:io';
import 'dart:math';

void main() {
  int guess;

  Random rand = new Random();
  int answer = rand.nextInt(100);
  do {
    print("Enter your guess");
    String temp = stdin.readLineSync(); //read in from the keyboard
    guess = int.parse(temp); //convert String to integerc
    if (guess < answer) {
      print("Too low!");
    } else if (guess > answer) {
      print("Too high!");
    }
  } while (guess != answer);
  print("You got it!");
}
