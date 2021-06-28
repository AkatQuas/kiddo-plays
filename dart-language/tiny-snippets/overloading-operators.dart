class Population {
  String name;
  int pop;
  Population(this.name, this.pop);
  operator &(Population other) =>
      new Population(name + " & " + other.name, pop + other.pop);
  operator +(int newPeople) => pop += newPeople;
  String toString() {
    return "$name has a population of $pop";
  }
}

void main() {
  Population springfield = new Population("Springfield", 2343);
  Population hanover = new Population("Hanover", 4000);
  Population both = springfield & hanover;
  print(both); // Prints: Springfield & Hanover has a population of 6343
  hanover + 1000;
  print(hanover); // Prints: Hanover has a population of 5000
}
