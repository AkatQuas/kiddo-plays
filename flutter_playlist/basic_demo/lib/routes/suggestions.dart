import 'package:flutter/material.dart';
import 'package:english_words/english_words.dart';

class Suggetions extends StatefulWidget {
  static const routeName = '/suggestions';
  @override
  SuggetionsState createState() => SuggetionsState();
}

class SuggetionsState extends State<Suggetions> {
  final List<WordPair> _suggestions = <WordPair>[];
  final Set<WordPair> _saved = Set<WordPair>();
  final TextStyle _biggerFont = const TextStyle(fontSize: 18.0);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Start up Name Generator'),
        actions: <Widget>[
          IconButton(icon: Icon(Icons.list), onPressed: _pushSaved),
        ],
      ),
      body: _buildSuggestions(),
    );
  }

  void _pushSaved() {
    print('routing away');
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (BuildContext context) {
        final Iterable<ListTile> tiles = _saved.map(
          (WordPair pair) {
            return ListTile(
              title: Text(
                pair.asPascalCase,
                style: _biggerFont,
              ),
              onTap: () {
                _saved.remove(pair);
              },
            );
          },
        );
        final List<Widget> divided =
            ListTile.divideTiles(tiles: tiles, context: context).toList();
        return Scaffold(
          appBar: AppBar(
            title: Text('Save Suggestions'),
          ),
          body: ListView(
            children: divided,
          ),
        );
      },
    ));
  }

  Widget _buildSuggestions() {
    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemBuilder: (context, i) {
        if (i.isOdd)
          return Divider(
            color: Color(0xFF42A5F5),
            thickness: 1.5,
          );
        final index = i ~/ 2;
        if (index >= _suggestions.length) {
          _suggestions.addAll(generateWordPairs().take(10));
        }
        return _buildRow(_suggestions[index]);
      },
    );
  }

  Widget _buildRow(WordPair pair) {
    final bool alreadySaved = _saved.contains(pair);
    return ListTile(
      title: Text(
        pair.asPascalCase,
        style: _biggerFont,
      ),
      trailing: Icon(
        alreadySaved ? Icons.favorite : Icons.favorite_border,
        color: alreadySaved ? Colors.deepOrange : Colors.grey,
      ),
      onTap: () {
        setState(() {
          if (alreadySaved) {
            _saved.remove(pair);
          } else {
            _saved.add(pair);
          }
        });
      },
    );
  }
}
