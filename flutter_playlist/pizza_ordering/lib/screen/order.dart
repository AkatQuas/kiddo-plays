import 'package:flutter/material.dart';
import 'package:pizza_ordering/code/pizza.dart';
import 'package:pizza_ordering/screen/review.dart';

class Order extends StatefulWidget {
  static const routeName = '/oredr';
  @override
  _OrderState createState() => _OrderState();
}

class _OrderState extends State<Order> {
  Pizza _order = Pizza();

  void _selectSize(PizzaSize v) {
    setState(() {
      _order.size = v;
    });
  }

  void _chooseToppings(int index, bool value) {
    setState(() {
      String key = _order.toppings.keys.elementAt(index);
      _order.toppings[key] = value;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Order Pizza'),
      ),
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Icon(
                    Icons.local_pizza,
                    color: Colors.orange,
                  ),
                  DropdownButton(
                    value: _order.size,
                    items: PizzaSize.values.map((size) {
                      return DropdownMenuItem(
                        value: size,
                        child: Text(size.toString()),
                      );
                    }).toList(),
                    onChanged: _selectSize,
                  ),
                ],
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: _order.toppings.length,
                  itemBuilder: (BuildContext context, int index) {
                    return CheckboxListTile(
                      controlAffinity: ListTileControlAffinity.leading,
                      title: Text(_order.toppings.keys.elementAt(index)),
                      value: _order.toppings.values.elementAt(index),
                      onChanged: (bool value) {
                        _chooseToppings(index, value);
                      },
                    );
                  },
                ),
              ),
              RaisedButton(
                onPressed: () {
                  Navigator.of(context).pushNamed(
                    Review.routeName,
                    arguments: ReviewRouteArguments(_order),
                  );
                },
                child: Text('Continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
