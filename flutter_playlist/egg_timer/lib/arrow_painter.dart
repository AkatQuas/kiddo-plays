import 'dart:math';
import 'package:flutter/material.dart';

class ArrowPainter extends CustomPainter {
  final Paint dialArrowPaint = Paint()
    ..color = Colors.black
    ..style = PaintingStyle.fill;

  final double rotationPercent;

  ArrowPainter({
    this.rotationPercent,
  });

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();

    final radius = -size.height / 2;
    canvas.translate(size.width / 2, size.height / 2);
    // rotate to the right rotation, and draw the triangle
    canvas.rotate(pi * 2 * rotationPercent);

    final path = Path();
    path.moveTo(0.0, radius - 10.0);
    path.lineTo(10.0, radius + 10.0);
    path.lineTo(-10.0, radius + 10.0);
    path.close();

    canvas.drawPath(path, dialArrowPaint);
    canvas.drawShadow(path, Colors.black, 3.0, false);
    canvas.restore();
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) {
    return true;
  }
}
