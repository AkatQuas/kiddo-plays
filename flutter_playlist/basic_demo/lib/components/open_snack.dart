import 'package:flutter/material.dart';

class OpenSnack extends StatefulWidget {
  @override
  _OpenSnackState createState() => _OpenSnackState();
}

class _OpenSnackState extends State<OpenSnack> {
  void _showSnack1() {
    final ScaffoldState state =
        context.findAncestorStateOfType<ScaffoldState>();
    if (state != null) {
      state.showSnackBar(
        SnackBar(
            content: Text('Snack bar by "context.findAncestorStateOfType"')),
      );
    }
  }

  void _showSnack2() {
    final ScaffoldState state = Scaffold.of(context);
    if (state != null) {
      state.showSnackBar(
        SnackBar(content: Text('Snack bar by invoking "Scaffod.of"')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: <Widget>[
        RaisedButton(
          onPressed: _showSnack1,
          child: Text('Snack 1'),
        ),
        RaisedButton(
          onPressed: _showSnack2,
          child: Text('Snack 2'),
        ),
      ],
    );
  }
}
