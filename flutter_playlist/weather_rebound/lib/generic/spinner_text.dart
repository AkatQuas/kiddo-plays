import 'package:flutter/material.dart';

class SpinnerText extends StatefulWidget {
  final String text;

  SpinnerText({
    Key key,
    this.text,
  }) : super(key: key);

  @override
  _SpinnerTextState createState() => _SpinnerTextState();
}

class _SpinnerTextState extends State<SpinnerText>
    with SingleTickerProviderStateMixin {
  String topText = '';
  String bottomText = '';
  AnimationController _animationController;
  Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    bottomText = widget.text;
    _animationController = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 600),
    )
      ..addListener(() => setState(() {}))
      ..addStatusListener((AnimationStatus status) {
        if (status == AnimationStatus.completed) {
          setState(() {
            bottomText = topText;
            topText = '';
            _animationController.value = 0.0;
          });
        }
      });

    _animation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.elasticInOut,
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(SpinnerText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.text != oldWidget.text) {
      topText = widget.text;
      _animationController.forward();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      clipper: RectClipper(),
      child: Stack(
        children: <Widget>[
          FractionalTranslation(
            translation: Offset(0.0, _animation.value - 1.0),
            child: Text(
              topText,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14.0,
              ),
              maxLines: 1,
            ),
          ),
          FractionalTranslation(
            translation: Offset(0.0, _animation.value),
            child: Text(
              bottomText,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14.0,
              ),
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class RectClipper extends CustomClipper<Rect> {
  @override
  getClip(Size size) {
    return Rect.fromLTWH(0.0, 0.0, size.width, size.height);
  }

  @override
  bool shouldReclip(CustomClipper oldClipper) {
    return true;
  }
}
