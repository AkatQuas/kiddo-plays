import 'package:egg_timer/egg_timer.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

String expandTick(int number) {
  final str = ('00' + number.toString());
  return str.substring(str.length - 2);
}

class TimerDisplay extends StatefulWidget {
  final EggTimerState eggTimerState;
  final Duration countDownTime;
  final Duration selectionTime;

  const TimerDisplay({
    Key key,
    this.eggTimerState,
    this.countDownTime = const Duration(seconds: 0),
    this.selectionTime = const Duration(seconds: 0),
  }) : super(key: key);

  @override
  _TimerDisplayState createState() => _TimerDisplayState();
}

class _TimerDisplayState extends State<TimerDisplay>
    with TickerProviderStateMixin {
  final _textStyle = const TextStyle(
    color: Colors.black,
    fontSize: 150.0,
    fontWeight: FontWeight.bold,
    letterSpacing: 10.0,
  );

  AnimationController _selectionSlideController;
  AnimationController _countDownSlideController;

  @override
  void initState() {
    super.initState();
    _selectionSlideController = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 300),
    )
      ..addListener(() {
        setState(() {});
      })
      ..addStatusListener((AnimationStatus status) {});

    _countDownSlideController = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 300),
    )
      ..addListener(() {
        setState(() {});
      })
      ..addStatusListener((AnimationStatus status) {});

    _countDownSlideController.value = 1.0;
  }

  @override
  void dispose() {
    _selectionSlideController.dispose();
    _countDownSlideController.dispose();
    super.dispose();
  }

  final DateFormat _countDownFormat = DateFormat('mm:ss');
  String get _selectionTime => expandTick(widget.selectionTime.inMinutes);
  String get _countDownTime => _countDownFormat.format(
        DateTime(
            DateTime.now().year, 0, 0, 0, 0, widget.countDownTime.inSeconds),
      );

  @override
  Widget build(BuildContext context) {
    if (widget.eggTimerState == EggTimerState.ready) {
      _selectionSlideController.reverse();
      _countDownSlideController.forward();
    } else {
      _selectionSlideController.forward();
      _countDownSlideController.reverse();
    }
    return Padding(
      padding: const EdgeInsets.only(top: 15.0),
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          Transform(
            transform: Matrix4.translationValues(
              0,
              -200.0 * _selectionSlideController.value,
              0,
            ),
            child: Text(
              _selectionTime,
              textAlign: TextAlign.center,
              style: _textStyle,
            ),
          ),
          Opacity(
            opacity: 1.0 - _countDownSlideController.value,
            child: Text(
              _countDownTime,
              textAlign: TextAlign.center,
              style: _textStyle,
            ),
          ),
        ],
      ),
    );
  }
}
