import 'dart:math';

import 'package:flutter/material.dart';
import 'package:fluttery_dart2/gestures.dart';

class DialTurnGestureDetector extends StatefulWidget {
  final Duration currentTime;
  final Duration maxTime;
  final Widget child;
  final Function(Duration) onTimeSelected;
  final Function() onDialStopTurning;

  const DialTurnGestureDetector({
    Key key,
    this.child,
    this.currentTime,
    this.maxTime,
    this.onTimeSelected,
    this.onDialStopTurning,
  }) : super(key: key);

  @override
  _DialTurnGestureDetectorState createState() =>
      _DialTurnGestureDetectorState();
}

class _DialTurnGestureDetectorState extends State<DialTurnGestureDetector> {
  PolarCoord _startCoord;
  Duration _startTime;
  Duration _selectedTime;
  _onRadialDragStart(PolarCoord coord) {
    _startCoord = coord;
    _startTime = widget.currentTime;
  }

  _onRadialDragUpdate(PolarCoord coord) {
    if (_startCoord != null) {
      final angleDiff = coord.angle - _startCoord.angle;
      final anglePercent =
          (angleDiff >= 0.0 ? angleDiff : angleDiff + (2 * pi)) / (2 * pi);
      final timeDiff = (anglePercent * widget.maxTime.inSeconds).round();
      _selectedTime = Duration(
        seconds: _startTime.inSeconds + timeDiff,
      );
      print('New time $_selectedTime');
      widget.onTimeSelected(_selectedTime);
    }
    print('dial ${coord.angle} $coord');
  }

  _onRadialDragEnd() {
    if (_selectedTime != null) {
      widget.onDialStopTurning();
    }
    _startCoord = null;
    _startTime = null;
    _selectedTime = null;
  }

  @override
  Widget build(BuildContext context) {
    return RadialDragGestureDetector(
      onRadialDragStart: _onRadialDragStart,
      onRadialDragUpdate: _onRadialDragUpdate,
      onRadialDragEnd: _onRadialDragEnd,
      child: widget.child,
    );
  }
}
