import 'dart:math';

import 'package:flutter/material.dart';

class RadialPosition extends StatelessWidget {
  final double radius;
  final Widget child;
  final double angle;

  RadialPosition({
    Key key,
    this.radius,
    this.angle,
    this.child,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final x = cos(angle) * radius;
    final y = sin(angle) * radius;

    return Transform(
      transform: Matrix4.translationValues(
        x,
        y,
        0.0,
      ),
      child: child,
    );
  }
}
