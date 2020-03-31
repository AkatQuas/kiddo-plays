import 'package:flutter/material.dart';
import 'package:weather_rebound/generic/spinner_text.dart';

class ForecastAppBar extends StatelessWidget {
  final VoidCallback onActionPressed;
  final String currentDay;
  ForecastAppBar({
    Key key,
    this.currentDay,
    @required this.onActionPressed,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      centerTitle: false,
      backgroundColor: Colors.transparent,
      elevation: 0.0,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SpinnerText(
            text: currentDay,
          ),
          Text(
            'Sacramento',
            style: TextStyle(
              fontSize: 30.0,
            ),
          ),
        ],
      ),
      actions: <Widget>[
        IconButton(
          icon: Icon(
            Icons.arrow_forward_ios,
            color: Colors.white,
            size: 35.0,
          ),
          onPressed: onActionPressed,
        )
      ],
    );
  }
}
