void log<T>(T value) {
  print(value);
}

S doubled<S>(S value) {
  return value;
}

T add<T extends num>(T value) {
  return value + 1;
}

class InventoryItem<ProductClass> {
  int quantity;
  double price;
  List<ProductClass> productsInInventory;
  List<ProductClass> productsArrivingSoon;
}

class Shouter<T> {
  int numberOfTimes;
  T thingToShout;

  Shouter(this.numberOfTimes, this.thingToShout);

  void shout() {
    for (int i = 0; i < numberOfTimes; i++) {
      print(thingToShout);
    }
  }
}

/// Named Optional Parameters
void repeat(String word, {int repetitions: 1, String exclamation: ""}) {
  for (int i = 0; i < repetitions; i++) {
    print(word + exclamation); // the + operator can concatenate strings
  }
}

typedef String ShoutFuncType(String payload);

@deprecated
typedef String uinter(String s1, String s2);

void talkAbout(String toShout, ShoutFuncType shoutFunc) {
  print(shoutFunc(toShout));
}

class owner {
  final String name;
  const owner(this.name);
}

@owner("John")
void importantFunc() {
  return;
}

@owner("David")
void implicitFunc() {
  importantFunc();
}

void main(List<String> args) {
  repeat("Dog"); // legal
  repeat("Dog", repetitions: 2, exclamation: "!"); // legal
  repeat("Dog", repetitions: 2); // legal
  repeat("Dog", exclamation: "!"); // legal, even without repetitions
  repeat("Dog", exclamation: "!", repetitions: 2); // legal, even out of order

  String exclame(String toExclame) => toExclame + "!";
  String manyTalk(String toMany) {
    String allTogether = "";
    for (int i = 0; i < 10; i++) {
      allTogether = allTogether +
          toMany; // keep concatenating toMany onto the end of itself
    }
    return allTogether;
  }

  talkAbout("Hello", exclame);
  talkAbout("TicTok", manyTalk);
  talkAbout("Wow", (String s) => s.toUpperCase()); // a function with no title!?

  Shouter<int> myShouter1 = new Shouter(23, 34);
  myShouter1.shout();
  Shouter<String> myShouter2 = new Shouter(12, "hello");
  myShouter2.shout();
}
