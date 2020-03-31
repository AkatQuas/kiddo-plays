import 'package:flutter/material.dart';

class FormInputRoute extends StatelessWidget {
  static const routeName = "/form_input";
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Form Input',
        ),
      ),
      body: FormInput(),
    );
  }
}

class FormInput extends StatelessWidget {
  _buildContent(context) {
    final List<Widget> children = [
      FormExample(),
      SingleInputFieldExample(),
      MiscExample(),
    ];
    return ListView(
      children: children
          .map((w) => Padding(
                padding: const EdgeInsets.all(10.0),
                child: w,
              ))
          .toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _buildContent(context),
    );
  }
}

class FormExample extends StatefulWidget {
  const FormExample({
    Key key,
  }) : super(key: key);

  @override
  _FormExampleState createState() => _FormExampleState();
}

class _FormExampleState extends State<FormExample> {
  final _formKey = GlobalKey<FormState>();
  final _unameController = TextEditingController(text: 'whatisname');
  final _passController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(
          color: Colors.yellow,
        ),
      ),
      child: Column(
        children: <Widget>[
          Text('Form Example'),
          Form(
            key: _formKey,
            autovalidate: true,
            child: Column(
              children: <Widget>[
                TextFormField(
                  controller: _unameController,
                  decoration: InputDecoration(
                    labelText: 'Username',
                    hintText: 'Email / Phone Number',
                    icon: Icon(Icons.person),
                  ),
                  validator: (v) =>
                      v.isEmpty ? 'Username can not be empty' : null,
                ),
                TextFormField(
                  obscureText: true,
                  controller: _passController,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'password',
                    icon: Icon(Icons.lock),
                  ),
                  validator: (v) {
                    if (v.length < 6) {
                      return 'At least 6 password';
                    }
                    if (v.length > 10) {
                      return 'At max 10 password';
                    }
                    return null;
                  },
                ),
                Row(
                  children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: RaisedButton(
                        onPressed: _printValues,
                        child: Text('Submit'),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: RaisedButton(
                        onPressed: _resetForm,
                        child: Text('Reset'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _printValues() {
    // you can not retrieve formState
    // by calling Form.of(context)
    // because the context is wrong
    if (_formKey.currentState.validate()) {
      print('Username ${_unameController.text}');
      print('Password ${_passController.text}');
    }
  }

  void _resetForm() {
    _formKey.currentState.reset();
  }
}

class MiscExample extends StatelessWidget {
  const MiscExample({
    Key key,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        TextField(
          decoration: InputDecoration(
            enabled: false,
            border: OutlineInputBorder(),
            labelText: 'Password',
            hintText: 'Input your password',
            errorText: 'password is wrong',
          ),
        ),
        TextField(
          decoration: InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Password',
            hintText: 'Input your password',
            errorText: 'password is wrong',
          ),
        ),
        TextField(
          decoration: InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Password',
            hintText: 'Input your password',
          ),
          textInputAction: TextInputAction.continueAction,
        ),
        TextField(
          decoration: InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Action.send and MaxLength',
            hintText: 'Send Action',
          ),
          maxLength: 10,
          textInputAction: TextInputAction.send,
        ),
        TextField(
          decoration: InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Action.search and MaxlengthEnforced',
            hintText: 'Search Action',
          ),
          maxLength: 10,
          maxLengthEnforced: false,
          textInputAction: TextInputAction.search,
        ),
        TextField(
          decoration: InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Action.newline',
            hintText: 'Action.newline',
          ),
          maxLines: 3,
          textInputAction: TextInputAction.newline,
        ),
        TextField(
          decoration: InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Action.emergencyCall',
            hintText: 'Action.emergencyCall',
          ),
          textInputAction: TextInputAction.emergencyCall,
        ),
        TextField(
          decoration: InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Action.unspecified',
            hintText: 'Action.unspecified',
          ),
          cursorRadius: Radius.circular(3.0),
          cursorWidth: 10.0,
          textInputAction: TextInputAction.unspecified,
        ),
      ],
    );
  }
}

class SingleInputFieldExample extends StatefulWidget {
  @override
  _SingleInputFieldExampleState createState() =>
      _SingleInputFieldExampleState();
}

class _SingleInputFieldExampleState extends State<SingleInputFieldExample> {
  TextEditingController usernameController;
  FocusNode usernameFocus = FocusNode();

  @override
  initState() {
    super.initState();
    usernameController = TextEditingController()..text = 'defaultUser';
  }

  _showUsername(context) {
    final scaffoldState = Scaffold.of(context);
    final name = usernameController.text;
    scaffoldState.showSnackBar(
      SnackBar(
        content: Text.rich(
          TextSpan(
            text: 'You username is: ',
            children: [
              TextSpan(
                text: name,
                style: TextStyle(
                  backgroundColor: Colors.purple,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 20.0),
      decoration: BoxDecoration(
        border: Border.all(
          color: Colors.amber,
        ),
      ),
      child: Column(
        children: <Widget>[
          Text('Single Input Field'),
          Row(
            children: <Widget>[
              GestureDetector(
                child: Text('UserName: '),
                onTap: () {
                  usernameFocus.requestFocus();
                },
              ),
              Expanded(
                child: TextField(
                  focusNode: usernameFocus,
                  controller: usernameController,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Username',
                    enabledBorder: UnderlineInputBorder(
                      borderSide: BorderSide(
                        color: Colors.cyan,
                      ),
                    ),
                    focusedBorder: UnderlineInputBorder(
                      borderSide: BorderSide(
                        color: Colors.green,
                      ),
                    ),
                    hintText: 'Phone/QQ',
                  ),
                ),
              ),
            ],
          ),
          RaisedButton(
            onPressed: () {
              usernameFocus.unfocus();
              _showUsername(context);
            },
            child: Text('Print User Name (hide keyboard)'),
          ),
          RaisedButton(
            onPressed: () {
              _showUsername(context);
            },
            child: Text('Print User Name'),
          ),
        ],
      ),
    );
  }
}
