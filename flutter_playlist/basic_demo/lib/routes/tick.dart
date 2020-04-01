import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import './score.dart';
import './setting.dart';
import './tip.dart';

class TickRoute extends StatefulWidget {
  @override
  _TickRouteState createState() => _TickRouteState();
}

class _TickRouteState extends State<TickRoute> {
  int _tick = 0;
  Timer _timer;

  @override
  void initState() {
    super.initState();
    print('$runtimeType Tick route initState, $_tick, $_timer');
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
  void didUpdateWidget(TickRoute oldWidget) {
    super.didUpdateWidget(oldWidget);
    print("$runtimeType didUpdateWidget");
  }

  @override
  void deactivate() {
    super.deactivate();
    print("$runtimeType deactive");
  }

  @override
  void reassemble() {
    super.reassemble();
    print("$runtimeType reassemble");
  }

  @override
  void dispose() {
    _timer.cancel();
    print('$runtimeType Tick route dispose');
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    print("$runtimeType didChangeDependencies");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Tick Route Page'),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8.0),
        child: Column(
          children: <Widget>[
            Text('Time is elapsing ... $_tick'),
            Text('This is really a new tick Route!'),
            Text(
                'And you can see every time you navigated here, the state refreshed!'),
            RaisedButton(
              child: Text('Let us move to the SETTING route!'),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (BuildContext context) {
                    return SettingRoute();
                  }),
                );
              },
            ),
            RaisedButton(
              child: Text('Let us move to the TIP route!'),
              onPressed: () async {
                ReturnValue result = await Navigator.push(
                  context,
                  MaterialPageRoute(
                      fullscreenDialog: true,
                      builder: (BuildContext context) {
                        return TipRoute(
                          text: 'What you want ?',
                        );
                      }),
                );
                print('When the tip route returns, we got "$result"');
              },
            ),
            RaisedButton(
              child: Text('Let us move to the SCORE route!'),
              onPressed: () async {
                final value = Random().nextInt(100);
                print('We have scored $value');
                Navigator.popAndPushNamed(context, ScoreRoute.routeName,
                    arguments: Score(value));
              },
            ),
            RaisedButton(
              child: Text('Let us move to the SCORE2 route!'),
              onPressed: () async {
                final value = Random().nextInt(100);
                print('We have scored $value');
                Navigator.popAndPushNamed(context, "score2",
                    arguments: Score(value));
              },
            ),
          ],
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
