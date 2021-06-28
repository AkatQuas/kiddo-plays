class Ticket {
  int age;
  // `factory`
  factory Ticket(int age) {
    if (age >= 18) {
      return new AdultTicket(age);
    } else {
      return new ChildTicket(age);
    }
  }
  Ticket._withAge(this.age);
}

class AdultTicket extends Ticket {
  AdultTicket(int age) : super._withAge(age);
}

class ChildTicket extends Ticket {
  ChildTicket(int age) : super._withAge(age);
}

void checkTicket() {
  Ticket t = new Ticket(17);
  print(t is ChildTicket); // prints true
}

class SimpleLogger {
  static SimpleLogger logger; // our single instance's representation

  factory SimpleLogger() {
    if (SimpleLogger.logger == null) {
      SimpleLogger.logger = new SimpleLogger._internal();
    }
    return SimpleLogger.logger;
  }

  SimpleLogger._internal(); // a private constructor

  void log(Object o) {
    print(o);
  }
}

void sameLogger() {
  SimpleLogger myLogger = new SimpleLogger();
  SimpleLogger myLogger2 = new SimpleLogger();
  print("myLogger == myLogger2 ?? ${myLogger == myLogger2}"); // prints true
}

void main() {
  checkTicket();
  sameLogger();
}
