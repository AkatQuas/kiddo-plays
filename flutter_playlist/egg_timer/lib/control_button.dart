import 'package:flutter/material.dart';

class ControlButton extends StatelessWidget {
  final IconData icon;
  final String text;
  final VoidCallback onPressed;
  final Color color;

  const ControlButton({
    Key key,
    @required this.icon,
    @required this.onPressed,
    this.text = 'button',
    this.color = Colors.transparent,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return FlatButton(
      splashColor: const Color(0x22000000),
      onPressed: onPressed,
      color: color,
      child: Padding(
        padding: const EdgeInsets.all(25.0),
        // color: ,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.only(right: 5.0),
              child: Icon(
                icon,
                color: Colors.black,
              ),
            ),
            Text(
              text,
              style: TextStyle(
                color: Colors.black,
                fontSize: 20.0,
                fontWeight: FontWeight.bold,
                letterSpacing: 3.0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
