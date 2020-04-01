import 'package:flutter/material.dart';

class TODOEmptyRoute extends StatelessWidget {
  static const routeName = "/todo_empty";

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'TODO_EMPTY',
        ),
      ),
      body: Column(
        children: <Widget>[],
      ),
    );
  }
}
