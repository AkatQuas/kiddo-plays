import 'package:flutter/material.dart';
import './screen.dart';

final helpUsScreen = Screen(
  title: 'HELP US GROW',
  background: DecorationImage(
    image: AssetImage('assets/other_screen_bk.jpg'),
    fit: BoxFit.cover,
    colorFilter: const ColorFilter.mode(
      const Color(0xCC994422),
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
              Image.asset('assets/help_us_card_photo.jpg'),
              Expanded(
                child: Center(
                  child: Text('This is the feedback screen!'),
                ),
              )
            ],
          ),
        ),
      ),
    );
  },
);
