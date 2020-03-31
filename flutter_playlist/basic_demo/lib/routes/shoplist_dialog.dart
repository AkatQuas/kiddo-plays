import 'package:flutter/material.dart';

typedef void CartChangedCallback(_Product product, bool inCart);

class ShoppingListPage extends StatelessWidget {
  static const routeName = "/shopping-list";
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text('Shopping List'),
        ),
        body: ShoppingList(
          products: [
            _Product(name: 'BB scream'),
            _Product(name: 'Sun scream'),
            _Product(name: 'Ruin then rain'),
          ],
        ));
  }
}

class ShoppingList extends StatefulWidget {
  ShoppingList({Key key, this.products}) : super(key: key);

  final List<_Product> products;

  @override
  _ShoppingListState createState() => _ShoppingListState();
}

class _ShoppingListState extends State<ShoppingList> {
  Set<_Product> _shoppingCart = Set<_Product>();

  void _handleCartChanged(_Product product, bool inCart) {
    if (!inCart) {
      setState(() {
        _shoppingCart.add(product);
      });
      return;
    }
    showDialog<void>(
      context: context,
      builder: (BuildContext _context) {
        return AlertDialog(
          title: Text('Cancel the checked'),
          content: Text('Are you sure to cancel the checked "${product.name}"'),
          actions: <Widget>[
            FlatButton(
              child: const Text('Cancel'),
              onPressed: () {
                Navigator.of(_context).pop();
              },
            ),
            FlatButton(
              child: const Text('Confirm'),
              onPressed: () {
                setState(() {
                  Navigator.of(_context).pop();
                  _shoppingCart.remove(product);
                });
              },
            ),
          ],
        );
      },
    );
  }

  @override
  void didUpdateWidget(ShoppingList oldWidget) {
    print(oldWidget.products.length);
    super.didUpdateWidget(oldWidget);
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      children: widget.products.map((_Product product) {
        return _ShoppingListItem(
          product: product,
          inCart: _shoppingCart.contains(product),
          onCartChanged: _handleCartChanged,
        );
      }).toList(),
    );
  }
}

class _Product {
  const _Product({this.name});

  final String name;
}

class _ShoppingListItem extends StatelessWidget {
  _ShoppingListItem({this.product, this.inCart, this.onCartChanged})
      : super(key: ObjectKey(product));

  final _Product product;

  final bool inCart;
  final CartChangedCallback onCartChanged;

  Color _getColor(BuildContext context) {
    return inCart ? Colors.black54 : Theme.of(context).primaryColor;
  }

  TextStyle _getTextStyle(BuildContext context) {
    if (!inCart) return null;

    return TextStyle(
      color: Colors.black54,
      decoration: TextDecoration.lineThrough,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: () {
        onCartChanged(product, inCart);
      },
      leading: CircleAvatar(
        backgroundColor: _getColor(context),
        child: Text(product.name[0]),
      ),
      title: Text(product.name, style: _getTextStyle(context)),
    );
  }
}
