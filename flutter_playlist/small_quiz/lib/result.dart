import 'package:flutter/material.dart';

class Result extends StatelessWidget {
  Result(this.score, this.restart);
  final int score;
  final VoidCallback restart;
  String get resultPhrase {
    var text = 'You did it with score: $score!';
    if (score > 100) {
      text += '\nQuite Good!';
    } else if (score > 150) {
      text += '\nAwesome';
    }
    return text;
  }
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        children: <Widget>[
          Text(
            resultPhrase,
            style: TextStyle(
              fontSize: 36,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          FlatButton(
            child: Text('Restart Quiz'),
            textColor: Colors.blue,
            onPressed: restart,
          ),
        ],
      ),
    );
  }
}
