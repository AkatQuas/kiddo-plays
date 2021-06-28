class Counter {
  static int _counter = 0;
  static int get counter => _counter;
  static set counter(int value) => _counter = value;
  int _c = 0;
  int get count => _counter;
  int get c => _c;
  addTen() {
    _c += 10;
  }
}

void main(List<String> args) {
  final c = Counter();
  final c2 = Counter();
  print(Counter._counter);
  print(Counter.counter);
  Counter.counter = 3;
  print(c.count);
  print(c2.count);

  print(c.c);
  print(c2.c);
  c.addTen();
  print(c.c);
  print(c2.c);
}
