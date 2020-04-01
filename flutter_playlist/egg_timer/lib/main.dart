import 'package:flutter/material.dart';

import './constants.dart';
import './controls.dart';
import './dial.dart';
import './egg_timer.dart';
import './timer_display.dart';

void main() => runApp(MyApp());

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  EggTimer eggTimer;

  void _onTimeSelected(Duration newTime) {
    setState(() {
      eggTimer.selectionTime = newTime;
    });
  }

  void _onDialStopTurning() {
    setState(() {
      eggTimer.start();
    });
  }

  void _onTimerUpdate(Duration time) {
    print("timer update ${time.inSeconds}");
    setState(() {});
  }

  void _onControlPaused() {
    setState(() {
      eggTimer.pause();
    });
  }

  void _onControlResume() {
    setState(() {
      eggTimer.resume();
    });
  }

  void _onControlRestart() {
    setState(() {
      eggTimer.restart();
    });
  }

  void _onControlReset() {
    setState(() {
      eggTimer.reset();
    });
  }

  _MyAppState() {
    eggTimer = EggTimer(
      maxTime: const Duration(minutes: 35),
      onTimerUpdate: _onTimerUpdate,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Egg Timer',
      theme: ThemeData(
        fontFamily: 'BebasNeue',
        primarySwatch: Colors.blue,
      ),
      home: Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: GRADIENT,
          ),
          child: Column(
            children: <Widget>[
              TimerDisplay(
                eggTimerState: eggTimer.state,
                countDownTime: eggTimer.currentTime,
                selectionTime: eggTimer.selectionTime,
              ),
              Dial(
                currentTime: eggTimer.currentTime,
                maxTime: eggTimer.maxTime,
                onTimeSelected: _onTimeSelected,
                onTimeSelectEnd: _onDialStopTurning,
              ),
              Expanded(
                child: Container(),
              ),
              Controls(
                eggTimerState: eggTimer.state,
                onPaused: _onControlPaused,
                onResume: _onControlResume,
                onRestart: _onControlRestart,
                onReset: _onControlReset,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
