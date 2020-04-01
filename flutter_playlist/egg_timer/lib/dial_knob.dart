import 'dart:math';

import 'package:flutter/material.dart';

import './arrow_painter.dart';
import './constants.dart';

class Knob extends StatefulWidget {
  const Knob({
    Key key,
    this.rotationPercent,
  }) : super(key: key);

  final double rotationPercent;

  @override
  _KnobState createState() => _KnobState();
}

class _KnobState extends State<Knob> {
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        Container(
          width: double.infinity,
          height: double.infinity,
          child: CustomPaint(
            painter: ArrowPainter(
              rotationPercent: widget.rotationPercent,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(10.0),
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
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                width: 1.5,
                color: const Color(0xFFDFDFDF),
              ),
            ),
            child: Center(
              child: Transform(
                transform: Matrix4.rotationZ(2 * pi * widget.rotationPercent),
                alignment: Alignment.center,
                child: Image.asset(
                  'assets/logo.png',
                  width: 50.0,
                  height: 50.0,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
