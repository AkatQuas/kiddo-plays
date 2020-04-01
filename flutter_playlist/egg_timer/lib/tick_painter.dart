import 'dart:math';

import 'package:flutter/material.dart';

class TickPainter extends CustomPainter {
  final _LONGTICK = 14.0;
  final _SHORTTICK = 4.0;

  final int tickCount;
  final ticksPerSection;
  final tickInset;
  final Paint tickPaint;
  final TextPainter textPainter;
  final textStyle = const TextStyle(
    fontFamily: 'BebasNeue',
    fontSize: 20.0,
    color: Colors.black,
  );

  TickPainter({
    this.tickCount = 35,
    this.ticksPerSection = 5,
    this.tickInset = 0,
  })  : tickPaint = Paint(),
        textPainter = TextPainter(
          textAlign: TextAlign.center,
          textDirection: TextDirection.ltr,
        ) {
    tickPaint.color = Colors.black;
    tickPaint.strokeWidth = 1.5;
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    final radius = 55.0 - size.height / 2;
    for (var i = 0; i < tickCount; i += 1) {
      final tickLength = i % ticksPerSection == 0 ? _LONGTICK : _SHORTTICK;
      canvas.drawLine(
        Offset(0.0, radius),
        Offset(0.0, radius - tickLength),
        tickPaint,
      );
      if (tickLength == _LONGTICK) {
        canvas.save();
        canvas.translate(0.0, -(size.height / 2) + 24.0);
        textPainter.text = TextSpan(
          text: '$i',
          style: textStyle,
        );
        // layout the text
        textPainter.layout();

        // rotate the canvas back so the text is up-side vertical
        canvas.rotate(-i * 2 * pi / tickCount);

        textPainter.paint(
          canvas,
          Offset(
            -(textPainter.width / 2),
            -(textPainter.height / 2),
          ),
        );
        canvas.restore();
      }

      canvas.rotate(2 * pi / tickCount);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) {
    return true;
  }
}
