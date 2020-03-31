import 'dart:async';

Future<bool> longWait(String prefix) async {
  for (var i = 0; i < 5; i++) {
    print('$prefix $i');
  }
  return true;
}

Future<void> testAsync() async {
  print('start');
  bool res = await longWait('ticking');
  print('end $res');
}

Future<void> testAsync2() async {
  print('start2');
  longWait('ticking2');
  print('end2');
}

void testAsync3() {
  print('start3');
  longWait('ticking3');
  print('end3');
}

void testAsync4() {
  print('start4');
  final f = longWait('ticking4');
  f.then((bool value) {
    print('end4 of future with $value');
  });
  print('end4');
}

void main(List<String> args) {
  testAsync();
  testAsync2();
  testAsync3();
  testAsync4();
}
