import 'package:flutter/material.dart';

class ProductControl extends StatelessWidget {
  ProductControl({
    this.addProduct
  });

  final Function addProduct;

  @override
  Widget build(BuildContext context) {
    return RaisedButton(
      color: Theme.of(context).primaryColor,
      onPressed: () {
        addProduct('Added Hello');
      },
      child: Text('Add Product'),
    );
  }
}
