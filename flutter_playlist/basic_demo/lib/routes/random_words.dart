import 'package:english_words/english_words.dart';
import 'package:flutter/material.dart';

class RandomWordsRoute extends StatelessWidget {
  static const routeName = "/random_words";
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Random Words'),
      ),
      body: RandomWords(),
    );
  }
}

class RandomWords extends StatefulWidget {
  @override
  _RandomWordsState createState() => _RandomWordsState();
}

class _RandomWordsState extends State<RandomWords> {
  newWord() {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final word = WordPair.random();
    return Stack(
      children: <Widget>[
        Container(
          padding: const EdgeInsets.all(10.0),
          alignment: Alignment.center,
          color: Colors.black12,
          child: Text(
            word.toString(),
            style: TextStyle(
              fontSize: 30.0,
              color: Colors.white,
            ),
          ),
        ),
        Positioned(
          left: 20.0,
          top: 20.0,
          child: RaisedButton(
            padding: const EdgeInsets.all(10.0),
            shape: RoundedRectangleBorder(
              side: BorderSide(
                color: Colors.amber,
              ),
              borderRadius: BorderRadius.circular(20.0),
            ),
            child: Row(
              children: <Widget>[
                Icon(Icons.refresh),
                Text('Get new word!'),
              ],
            ),
            onPressed: newWord,
          ),
        ),
      ],
    );
  }
}
