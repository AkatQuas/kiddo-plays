import 'package:flutter/material.dart';
import 'package:pizza_ordering/screen/order.dart';

class Home extends StatelessWidget {
  static const routeName = '/';
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Pizza Ordering'),
      ),
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: <Widget>[
              Image.asset('images/pizza.jpg'),
              RaisedButton(
                child: Text('Order a Pizza!'),
                onPressed: () {
                  Navigator.of(context).pushNamed(Order.routeName);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
