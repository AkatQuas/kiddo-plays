import 'package:flutter/material.dart';
import 'package:weather_rebound/forecast/radial_list.dart';
import './generic/slide_drawer.dart';

import './forecast/forecast.dart';
import './forecast/app_bar.dart';
import './forecast/week_drawer.dart';
import './forecast/list.dart';
import './current_week.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Weather Rebound',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        textTheme: TextTheme(
          body1: TextStyle(
            color: Colors.white,
            fontSize: 16.0,
          ),
        ),
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

class _MyHomePageState extends State<MyHomePage> with TickerProviderStateMixin {
  OpenableController _openableController;
  SlideRadialListController slideRadialListController;
  final List<String> week = getCurrentWeek();
  String currentDay = '';

  @override
  initState() {
    super.initState();
    currentDay = _formatDate(week[0]);
    _openableController = OpenableController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    )..addListener(() => setState(() {}));

    slideRadialListController = SlideRadialListController(
      vsync: this,
      itemCount: forecastRadialList.items.length,
    )..open();
  }

  @override
  void dispose() {
    _openableController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: <Widget>[
          Forecast(
            forecastList: forecastRadialList,
            slideRadialListController: slideRadialListController,
          ),
          Positioned(
            top: 0.0,
            left: 0.0,
            right: 0.0,
            child: ForecastAppBar(
              currentDay: currentDay,
              onActionPressed: _openableController.open,
            ),
          ),
          SlideDrawer(
            openableController: _openableController,
            content: WeekDrawer(
              week: week,
              onDaySelected:
                  _openableController.isOpen ? _handleDaySelected : null,
            ),
          ),
        ],
      ),
    );
  }

  _handleDaySelected(String date) {
    setState(() {
      currentDay = _formatDate(date);
      slideRadialListController
          .close()
          .then((_) => slideRadialListController.open());
      _openableController.close();
    });
  }

  _formatDate(String day) => day.replaceAll('\n', ',');
}
