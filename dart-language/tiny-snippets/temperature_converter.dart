import 'dart:io';

double F2C(int f) {
  return (f - 32) / 1.8;
}

double C2F(int c) {
  return c * 1.8 + 32;
}

void main() {
  print("A:Convert Celsius to Fahrenheit\nB:Convert Fahrenheit to Celsius");
  String selection;
  do {
    selection = stdin.readLineSync().toUpperCase(); //get uppercase input
  } while (selection != "A" && selection != "B"); //think of && like AND
  print("Enter the starting temperature:");
  String inTemp = stdin.readLineSync();
  int temp = int.parse(inTemp);
  switch (selection) {
    case "A":
      print("$temp degrees Celsius is ${C2F(temp)} degrees Fahrenheit");
      break;
    case "B":
      print("$temp degrees Fahrenheit is ${F2C(temp)} degrees Celsius");
      break;
    default:
      break;
  }
}
