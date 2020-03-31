import 'package:flutter/material.dart';
import 'package:pizza_ordering/code/pizza.dart';

class ReviewRouteArguments {
  final Pizza order;
  ReviewRouteArguments(this.order);
}

class Review extends StatelessWidget {
  static const routeName = '/review';
  final Pizza order;
  final List<String> _list = List();

  Review({
    this.order,
  }) {
    _list.addAll([
      'Size: ${order.size}',
      ' ',
      'Toppings',
    ]);
    order.toppings.forEach((String name, bool added) {
      if (added) {
        _list.add(name);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Review Pizza Order'),
      ),
      body: Container(
        padding: EdgeInsets.all(32.0),
        child: Column(
          children: <Widget>[
            Text(
              'Review your order:',
              style: TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
            Expanded(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _list.length,
                itemBuilder: (BuildContext context, int index) {
                  return Text(_list.elementAt(index));
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
