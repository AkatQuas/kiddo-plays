import 'dart:async';

import 'package:flutter/material.dart';

class SettingRoute extends StatefulWidget {
  @override
  _SettingRouteState createState() => _SettingRouteState();
}

class _SettingRouteState extends State<SettingRoute> {
  int _tick = 0;
  Timer _timer;

  @override
  void initState() {
    super.initState();
    print('New setting route initState, $_tick, $_timer');
    _timer = Timer.periodic(
      const Duration(seconds: 1),
      (Timer timer) {
        setState(() {
          _tick += 1;
        });
      },
    );
  }

  @override
  void dispose() {
    _timer.cancel();
    print('New setting route died');
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('New Setting Page'),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8.0),
        child: Column(
          children: <Widget>[Text('Time is elapsing ... $_tick')],
        ),
      ),
      floatingActionButton: FloatingActionButton(
          child: Icon(Icons.flip_to_back),
          onPressed: () {
            Navigator.pop(context);
          }),
    );
  }
}
