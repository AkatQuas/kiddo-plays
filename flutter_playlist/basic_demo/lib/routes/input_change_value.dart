import 'package:flutter/material.dart';

class InputChangeValue extends StatelessWidget {
  static const routeName = "/input-change-value";
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Input Value Change'),
      ),
      body: Center(
        child: TextControl(),
      ),
    );
  }
}

class TextControl extends StatefulWidget {
  @override
  State<StatefulWidget> createState() {
    return _TextControlState();
  }
}

class _TextControlState extends State<TextControl> {
  String _text = 'old text';

  final _formKey = GlobalKey<FormState>();

  final myController = TextEditingController();

  void changeText() {
    if (_formKey.currentState.validate()) {
      print(myController.text);
      setState(() {
        _text = myController.text;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.all(10.0),
      child: Column(
        children: <Widget>[
          Form(
            key: _formKey,
            child: Row(
              // mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: <Widget>[
                Expanded(
                  child: TextFormField(
                    controller: myController,
                    decoration: const InputDecoration(
                      hintText: 'Enter the new text',
                    ),
                    validator: (value) {
                      if (value.isEmpty) {
                        return 'Please enter some text';
                      }
                      return null;
                    },
                    onSaved: (value) {
                      print('saved $value');
                    },
                  ),
                ),
                RaisedButton(
                  onPressed: changeText,
                  elevation: 10,
                  child: Text(
                    'Change',
                    style: TextStyle(
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
              ],
            ),
          ),
          TextOutput(_text),
          Container(
            margin: EdgeInsets.all(10.0),
            width: 250.0,
            height: 50.0,
            child: RaisedButton(
              onPressed: () {
                openAlert(context);
              },
              child: Text('Open Dialog'),
            ),
          ),
        ],
      ),
    );
  }

  openAlert(BuildContext context) {
    var alertDialog = AlertDialog(
      title: Text('Show the Dialog'),
      content: Text('With some content'),
      actions: <Widget>[
        FlatButton(
          onPressed: () {
            Navigator.pop(context);
          },
          child: Text('action 1'),
        ),
        FlatButton(
          onPressed: () {
            Navigator.pop(context);
          },
          child: Text('action 2'),
        ),
        FlatButton(
          onPressed: () {
            Navigator.pop(context);
          },
          child: Text('action 3'),
        ),
      ],
    );
    showDialog(
      context: context,
      builder: (BuildContext context) => alertDialog,
    );
  }
}

class TextOutput extends StatelessWidget {
  final String text;

  TextOutput(this.text);

  @override
  Widget build(BuildContext context) {
    return Container(
      child: Text(
        text,
        style: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
      ),
      margin: EdgeInsets.all(10.0),
    );
  }
}
