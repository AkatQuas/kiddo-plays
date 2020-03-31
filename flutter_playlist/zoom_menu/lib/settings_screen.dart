import 'package:flutter/material.dart';
import './screen.dart';

final settingsScreen = Screen(
  title: 'SETTINGS',
  background: DecorationImage(
    image: AssetImage('assets/other_screen_bk.jpg'),
    fit: BoxFit.cover,
    colorFilter: const ColorFilter.mode(
      const Color(0xCC008822),
      BlendMode.multiply,
    ),
  ),
  contentBuilder: (BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(25.0),
        child: Card(
          child: Column(
            children: <Widget>[
              Image.asset('assets/settings_card_photo.jpg'),
              Expanded(
                child: Center(
                  child: Text('This is setting screen!'),
                ),
              )
            ],
          ),
        ),
      ),
    );
  },
);
