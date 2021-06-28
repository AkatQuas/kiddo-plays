import "dart:io";

class UnderageException implements Exception {
  String message; // for the programmer's reference
  UnderageException(this.message);
  String toString() {
    return message;
  }
}

class TommyException implements Exception {
  // look how simple it is!
  String toString() {
    return "TommyException: Tommy is not allowed in here ever!";
  }
}

class Person {
  String name;
  int age;
  Person(this.name, this.age);
}

class Bar {
  List<Person> currentPatrons = new List();
  void checkId(Person p) {
    if (p.name == "Tommy") {
      throw new TommyException();
    } else if (p.age < 21) {
      throw new UnderageException(
          "UnderageException: ${p.name} is not old enough.");
    } else {
      currentPatrons.add(p);
    }
  }
}

void main() {
  Bar bar = new Bar();
  try {
    bar.checkId(new Person("Tommy", 25));
    bar.checkId(new Person("Jimmy", 22));
    bar.checkId(new Person("Sandra", 17));
  } catch (e) {
    print(e);
  }
  print(bar.currentPatrons);

  int userAnswer;
  List<String> names = ["Karl", "Mark", "Adam", "Seth"];
  String which;
  print("What index in the names List do you want to look at?");
  which = stdin.readLineSync();
  try {
    userAnswer = int.parse(which);
    print(names[userAnswer]);
  } on FormatException {
    print("Could not understand the input.");
  } on RangeError {
    print("No name for index chosen.");
  } finally {
    print("You selected $which out of ${names.length}");
  }
}
