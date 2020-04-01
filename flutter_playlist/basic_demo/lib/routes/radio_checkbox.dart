import 'package:flutter/material.dart';

class RadioCheckBoxRoute extends StatefulWidget {
  static const routeName = "/radio_checkbox";

  @override
  _RadioCheckBoxRouteState createState() => _RadioCheckBoxRouteState();
}

class _RadioCheckBoxRouteState extends State<RadioCheckBoxRoute> {
  bool _switchSelected = false;
  bool _checkBoxSelected = false;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Radio and Checkbox',
        ),
      ),
      body: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              Switch(
                value: _switchSelected,
                activeColor: Colors.red,
                activeTrackColor: Colors.yellow,
                onChanged: (value) {
                  print('Switch changed to $value');
                  setState(() {
                    _switchSelected = value;
                  });
                },
              ),
              Text('Switch '),
            ],
          ),
          Row(
            children: <Widget>[
              Transform.scale(
                scale: 2.5,
                child: Switch(
                  value: _switchSelected,
                  inactiveTrackColor: Colors.purple,
                  inactiveThumbColor: Colors.black,
                  activeColor: Colors.green,
                  activeTrackColor: Colors.brown[600],
                  onChanged: (value) {},
                ),
              ),
              Text('different color and Scaled'),
            ],
          ),
          Row(
            children: <Widget>[
              Switch(
                value: !_switchSelected,
                activeTrackColor: Colors.amber,
                activeThumbImage: AssetImage('assets/24731539.jpeg'),
                onChanged: (value) {
                  print('Versed Switch changed to $value');
                  setState(() {
                    _switchSelected = !value;
                  });
                },
              ),
              Text('Versed Switch , 这里有个坑！'),
            ],
          ),
          Row(
            children: <Widget>[
              Checkbox(
                value: _checkBoxSelected,
                onChanged: (value) {
                  print('Checkbox changed to $value');
                  setState(() {
                    _checkBoxSelected = value;
                  });
                },
              ),
              Text(_checkBoxSelected ? 'checed' : 'not'),
            ],
          ),
        ],
      ),
    );
  }
}
