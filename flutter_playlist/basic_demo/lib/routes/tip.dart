import 'package:flutter/material.dart';

class TipRoute extends StatelessWidget {
  final String text;

  TipRoute({
    Key key,
    this.text,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: Container(),
        title: Text('Tip Route'),
      ),
      body: Center(
        child: Column(
          children: <Widget>[
            Text(text),
            RaisedButton(
              onPressed: () {
                Navigator.pop<ReturnValue>(context, ReturnValue('returnValue'));
              },
              child: Text('Back <-'),
            ),
          ],
        ),
      ),
    );
  }
}

class ReturnValue {
  final String text;

  ReturnValue(this.text);

  @override
  String toString() {
    return 'what you want except from $text ?';
  }
}
