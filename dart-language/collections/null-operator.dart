void main(List<String> args) {
  User user = User();
  user.name ??= 'hello';
  print(user.name == 'hello');

  User user2 = User(name: 'dart');

  user2.name ??= 'hello';
  print(user2.name == 'hello');

  print(addNumbers(1, 2));
  print(addNumbers(1, 2, 3));
  print(addNumbers(1, 2, 3, 4));
}

class User {
  String name;
  User({
    this.name,
  });
}

int addNumbers(int x, int y, [int z = 5, int d]) {
  var sum = x + y + z;

  sum += d ?? 0;

  return sum;
}
