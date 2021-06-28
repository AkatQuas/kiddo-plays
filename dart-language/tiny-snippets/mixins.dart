class Wheels {
  int get wheels => 4;
}

class Car {
  String get color => 'blue';

  num get width => 1.5;
}

class Truck {
  String get color => 'black';
  num get width => 2.0;
}

class Roadster extends Car {}

class Jeep extends Truck {}

class SUV extends Car with Truck, Wheels {}

class CUV extends Truck with Car, Wheels {}

void main(List<String> args) {
  final suv = SUV();
  final cuv = CUV();
  final jeep = Jeep();
  final roadster = Roadster();
  print('suv has color ${suv.color}, cuv has color ${cuv.color}');
  print('jeep has color ${jeep.color}, roadster has color ${roadster.color}');
  print('suv has width ${suv.width}, cuv has width ${cuv.width}');
  print('jeep has width ${jeep.width}, roadster has width ${roadster.width}');
  print('suv has wheels ${suv.wheels}, cuv has wheels ${cuv.wheels}');
}
