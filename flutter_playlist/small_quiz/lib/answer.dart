import 'package:flutter/material.dart';

class Answer extends StatelessWidget {
  Answer(this.text,this.handler);

  final VoidCallback handler;

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      child: RaisedButton(
        color: Colors.blue,
        textColor: Colors.white,
        child: Text(text),
        onPressed: this.handler,
      ),
    );
  }
}
