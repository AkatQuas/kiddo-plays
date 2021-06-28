import 'dart:math';

void main() {
  const int ITERATIONS = 100000; //the higher the more accurate 3.0;
  double series = 1.0;
  double denominator = 3.0;
  double negate = -1.0;

  for (int i = 0; i < ITERATIONS; i++) {
    series += (negate * (1 / denominator));
    denominator += 2.0;
    negate *= -1.0;
  }
  double mypi = 4 * series;
  print("We calculated pi as $mypi");
  print("The real pi is $pi");
  print("We were off by ${pi - mypi}");
}
