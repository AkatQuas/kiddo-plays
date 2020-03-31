import 'package:flutter/material.dart';

class Products extends StatelessWidget {
  Products(this.products) {
    print('[Products Widget] Constructor');
  }

  final List<String> products;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: products
          .map((el) => Card(
                child: Column(
                  children: <Widget>[
                    Image.asset('assets/food.jpeg'),
                    Text(el),
                  ],
                ),
              ))
          .toList(),
    );
  }
}
