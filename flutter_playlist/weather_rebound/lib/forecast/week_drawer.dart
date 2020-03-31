import 'package:flutter/material.dart';

class WeekDrawer extends StatelessWidget {
  final List<String> week;
  final Function(String day) onDaySelected;

  WeekDrawer({
    Key key,
    @required this.week,
    this.onDaySelected,
  }) : super(key: key);

  List<Widget> _buildWeekButton() {
    return week
        .map((date) => Expanded(
              child: GestureDetector(
                child: Text(
                  date,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14.0,
                  ),
                ),
                onTap: () {
                  onDaySelected(date);
                },
              ),
            ))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 125.0,
      height: double.infinity,
      color: const Color(0xAA234060),
      child: Column(
        children: <Widget>[
          Expanded(
            child: Icon(
              Icons.refresh,
              color: Colors.white,
              size: 40.0,
            ),
          ),
        ]..addAll(_buildWeekButton()),
      ),
    );
  }
}
