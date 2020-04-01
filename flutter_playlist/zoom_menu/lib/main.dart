import 'package:flutter/material.dart';

import './zoom_scaffold.dart';
import './settings_screen.dart';
import './help_us_screen.dart';
import './hero_sceen.dart';
import './restaurant_screen.dart';
import './menu_screen.dart';
import './screen.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Zoom Menu',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({Key key}) : super(key: key);

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  Screen activeScreen = restaurantScreen;
  final menuItems = [
    MenuItem(
      id: 'restaurant',
      title: 'THE PADDOCK',
      screen: restaurantScreen,
    ),
    MenuItem(
      id: 'hero',
      title: 'THE HERO',
      screen: heroScreen,
    ),
    MenuItem(
      id: 'help',
      title: 'HELP US GROW',
      screen: helpUsScreen,
    ),
    MenuItem(
      id: 'settings',
      title: 'SETTINGS',
      screen: settingsScreen,
    ),
  ];
  @override
  Widget build(BuildContext context) {
    return ZoomScaffold(
      menuScreen: MenuScreen(
        menu: Menu(items: menuItems),
        onItemSelect: (MenuItem item) {
          setState(() {
            print('id ${item.id}');
            activeScreen = item.screen;
          });
        },
      ),
      contentScreen: activeScreen,
    );
  }
}
