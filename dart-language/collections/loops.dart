void main() {
  List<String> pets = ['Abe', 'Buck', 'Yeti'];
  for (final pet in pets) {
    print(pet);
  }

  pets.forEach((pet) => pet.length);

  for (final p in (pets.map((p) => p + ':dog'))) {
    print(p);
  }
}
