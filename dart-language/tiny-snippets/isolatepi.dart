import "dart:isolate";

// sp is kindof a channel or signla tunnel
void calcPi(SendPort sp) {
  const int ITERATIONS = 1000000000; // the higher the more accurate
  double series = 1.0;
  double denominator = 3.0;
  double negate = -1.0;
  for (int i = 0; i < ITERATIONS; i++) {
    series += (negate * (1 / denominator));
    denominator += 2.0;
    negate *= -1.0;
  }
  double pi = 4 * series;
  sp.send(pi); // send the result back
}

void main() {
  ReceivePort rp = new ReceivePort();
  rp.listen((data) {
    // data is what we receive from sp.send()
    print("Pi is $data");
    rp.close(); // we're done, close up shop
  });
  Isolate.spawn(calcPi, rp.sendPort); // start the Isolate
}
