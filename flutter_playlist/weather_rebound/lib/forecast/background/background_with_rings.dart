import 'package:flutter/material.dart';

class BackgroundWithRings extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        Image.asset('assets/weather_bk_enlarged.png', fit: BoxFit.cover),
        ClipOval(
          clipper: CircleClipper(
            radius: 140.0,
            offset: const Offset(40.0, 0.0),
          ),
          child: Image.asset(
            'assets/weather_bk.png',
            fit: BoxFit.cover,
          ),
        ),
        CustomPaint(
          painter: WhiteCircleCutoutPainter(
            centerOffset: const Offset(40.0, 0.0),
            circles: [
              Circle(radius: 140.0, alpha: 0x10),
              Circle(radius: 140.0 + 15.0, alpha: 0x28),
              Circle(radius: 140.0 + 30.0, alpha: 0x38),
              Circle(radius: 140.0 + 75.0, alpha: 0x50),
            ],
          ),
          child: Container(),
        ),
      ],
    );
  }
}

class CircleClipper extends CustomClipper<Rect> {
  final double radius;
  final Offset offset;

  CircleClipper({
    this.radius,
    this.offset,
  });

  @override
  Rect getClip(Size size) {
    return Rect.fromCircle(
      radius: radius,
      center: Offset(0.0, size.height / 2) + offset,
    );
  }

  @override
  bool shouldReclip(CustomClipper<Rect> oldClipper) {
    return true;
  }
}

class WhiteCircleCutoutPainter extends CustomPainter {
  final List<Circle> circles;
  final Color overlayColor = const Color(0xFFAA88AA);
  final Offset centerOffset;
  final Paint whitePaint;
  final Paint borderPaint;

  WhiteCircleCutoutPainter({
    this.circles = const [],
    this.centerOffset = const Offset(0.0, 0.0),
  })  : whitePaint = Paint(),
        borderPaint = Paint()
          ..color = const Color(0x10FFFFF)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.0;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    for (var i = 1; i < circles.length; i++) {
      final previousCircle = circles[i - 1];
      final currentCircle = circles[i];
      final center = Offset(0.0, size.height / 2) + centerOffset;

      _maskCircle(canvas, size, previousCircle.radius);

      whitePaint.color = overlayColor.withAlpha(previousCircle.alpha);
      canvas.drawCircle(
        center,
        currentCircle.radius,
        whitePaint,
      );
      canvas.drawCircle(
        center,
        currentCircle.radius,
        borderPaint,
      );
      if (currentCircle == circles.last) {
        // mask the area of the final circle
        _maskCircle(canvas, size, currentCircle.radius);
        // draw an overlay that fills the rest of the screen
        whitePaint.color = overlayColor.withAlpha(currentCircle.alpha);
        canvas.drawRect(
          Rect.fromLTWH(0.0, 0.0, size.width, size.height),
          whitePaint,
        );
        canvas.drawCircle(
          center,
          currentCircle.radius,
          borderPaint,
        );
      }
    }

    canvas.restore();
  }

  _maskCircle(Canvas canvas, Size size, double radius) {
    Path clippedCircle = Path();
    clippedCircle.fillType = PathFillType.evenOdd;
    clippedCircle.addRect(Rect.fromLTWH(0.0, 0.0, size.width, size.height));
    clippedCircle.addOval(
      Rect.fromCircle(
        center: Offset(0.0, size.height / 2) + centerOffset,
        radius: radius,
      ),
    );
    canvas.clipPath(clippedCircle);
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) {
    return true;
  }
}

class Circle {
  final double radius;
  final int alpha;

  Circle({
    this.radius,
    this.alpha = 0xFF,
  });
}
