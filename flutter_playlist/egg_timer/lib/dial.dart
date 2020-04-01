import 'package:flutter/material.dart';

import './constants.dart';
import './dial_knob.dart';
import './dial_turn_gesture.dart';
import './tick_painter.dart';

class Dial extends StatefulWidget {
  Dial({
    Key key,
    this.currentTime = const Duration(minutes: 10),
    this.maxTime = const Duration(minutes: 35),
    this.tickPerSection = 5,
    @required this.onTimeSelected,
    @required this.onTimeSelectEnd,
  }) : super(key: key);

  final Duration currentTime;
  final Duration maxTime;
  final int tickPerSection;
  final Function(Duration) onTimeSelected;
  final Function() onTimeSelectEnd;

  @override
  _DialState createState() => _DialState();
}

class _DialState extends State<Dial> with TickerProviderStateMixin {
  AnimationController resetToZeroController;
  Animation resetToZeroAnimation;

  @override
  void initState() {
    super.initState();
    resetToZeroController = AnimationController(
      vsync: this,
    );
  }

  @override
  void dispose() {
    super.dispose();
  }

  double get _rotationPercent =>
      widget.currentTime.inSeconds / widget.maxTime.inSeconds;

  @override
  Widget build(BuildContext context) {
    return DialTurnGestureDetector(
      onTimeSelected: widget.onTimeSelected,
      maxTime: widget.maxTime,
      currentTime: widget.currentTime,
      onDialStopTurning: widget.onTimeSelectEnd,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 45.0),
        child: AspectRatio(
          aspectRatio: 1.0,
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: GRADIENT,
              boxShadow: [
                BoxShadow(
                  color: const Color(0x44000000),
                  blurRadius: 2.0,
                  spreadRadius: 1.0,
                  offset: const Offset(0.0, 1.0),
                ),
              ],
            ),
            child: Stack(
              children: <Widget>[
                Container(
                  width: double.infinity,
                  height: double.infinity,
                  child: CustomPaint(
                    painter: TickPainter(
                      tickCount: widget.maxTime.inMinutes,
                      ticksPerSection: widget.tickPerSection,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(65.0),
                  child: Knob(
                    rotationPercent: _rotationPercent,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
