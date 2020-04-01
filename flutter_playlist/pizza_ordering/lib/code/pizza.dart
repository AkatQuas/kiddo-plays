enum PizzaSize {
  small,
  medium,
  large,
}

class Pizza {
  PizzaSize size = PizzaSize.small;

  Map<String, bool> toppings = new Map();

  Pizza() {
    toppings.putIfAbsent('Pepperoni', () => false);
    toppings.putIfAbsent('Sausage', () => false);
    toppings.putIfAbsent('Cheeze', () => false);
    toppings.putIfAbsent('Pineapple', () => false);
    toppings.putIfAbsent('Onions', () => false);
    toppings.putIfAbsent('Sardines', () => false);
    toppings.putIfAbsent('Mushrooms', () => false);
    toppings.putIfAbsent('Peppers', () => false);
    toppings.putIfAbsent('Pickles', () => false);
    toppings.putIfAbsent('Chocolate', () => false);
    toppings.putIfAbsent('Banana', () => false);
    toppings.putIfAbsent('Olivers', () => false);
  }
}
