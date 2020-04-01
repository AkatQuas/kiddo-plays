import './routes/clips.dart';
import './routes/infinite_loading.dart';
import './routes/tabber.dart';
import './routes/grid_view.dart';
import 'package:flutter/material.dart';

import './components/open_snack.dart';
import './components/navigate_button.dart';
import './routes/score.dart';
import './routes/tick.dart';
import './routes/random_words.dart';
import './routes/suggestions.dart';
import './routes/image_fit.dart';
import './routes/image_blend.dart';
import './routes/my_icons.dart';
import './routes/radio_checkbox.dart';
import './routes/progress_indicator.dart';
import './routes/input_change_value.dart';
import './routes/form_input.dart';
import './routes/custom_scroll.dart';
import './routes/complex_counter.dart';
import './routes/shoplist_dialog.dart';
import './routes/rating_card.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Basic Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        textTheme: TextTheme(
          body1: TextStyle(
            fontSize: 20.0,
          ),
        ),
      ),
      home: MyHomePage(title: 'Flutter Basic Home'),
      routes: {
        "/score2": (BuildContext context) {
          final Score score = ModalRoute.of(context).settings.arguments;
          return ScoreRoute(
            score: score,
          );
        },
        ComplexCounter.routeName: (BuildContext context) => ComplexCounter(),
        ScoreRoute.routeName: (BuildContext context) => ScoreRoute(),
        RandomWordsRoute.routeName: (BuildContext context) =>
            RandomWordsRoute(),
        Suggetions.routeName: (BuildContext context) => Suggetions(),
        ImageFitRoute.routeName: (BuildContext context) => ImageFitRoute(),
        ImageBlendRoute.routeName: (BuildContext context) => ImageBlendRoute(),
        MyIconsRoute.routeName: (BuildContext context) => MyIconsRoute(),
        RadioCheckBoxRoute.routeName: (BuildContext context) =>
            RadioCheckBoxRoute(),
        ProgressIndicatorRoute.routeName: (BuildContext context) =>
            ProgressIndicatorRoute(),
        FormInputRoute.routeName: (BuildContext context) => FormInputRoute(),
        ClipsRoute.routeName: (BuildContext context) => ClipsRoute(),
        InfiniteLoadingRoute.routeName: (BuildContext context) =>
            InfiniteLoadingRoute(),
        GridViewRoute.routeName: (BuildContext context) => GridViewRoute(),
        InputChangeValue.routeName: (BuildContext context) =>
            InputChangeValue(),
        ShoppingListPage.routeName: (BuildContext context) =>
            ShoppingListPage(),
        CustomScrollRoute.routeName: (BuildContext context) =>
            CustomScrollRoute(),
        RatingCard.routeName: (BuildContext context) => RatingCard(),
      },
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({
    Key key,
    this.title,
  }) : super(key: key);

  final String title;

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  final List<_NavigateObject> routeList = [
    _NavigateObject('Complex counter', ComplexCounter.routeName),
    _NavigateObject(
      'My Icons Customize',
      MyIconsRoute.routeName,
    ),
    _NavigateObject(
      'Random Word',
      RandomWordsRoute.routeName,
    ),
    _NavigateObject(
      'Suggetions from words',
      Suggetions.routeName,
    ),
    _NavigateObject(
      'Input Change Updater',
      InputChangeValue.routeName,
    ),
    _NavigateObject(
      'Image Fit Types',
      ImageFitRoute.routeName,
    ),
    _NavigateObject(
      'Image Blend Types',
      ImageBlendRoute.routeName,
    ),
    _NavigateObject(
      'Radio CheckBox',
      RadioCheckBoxRoute.routeName,
    ),
    _NavigateObject(
      'Progress Indicator',
      ProgressIndicatorRoute.routeName,
    ),
    _NavigateObject(
      'Form Input',
      FormInputRoute.routeName,
    ),
    _NavigateObject(
      'Clip Types',
      ClipsRoute.routeName,
    ),
    _NavigateObject(
      'Infinite Loading',
      InfiniteLoadingRoute.routeName,
    ),
    _NavigateObject(
      'Grid View',
      GridViewRoute.routeName,
    ),
    _NavigateObject(
      'Custom Scroll',
      CustomScrollRoute.routeName,
    ),
    _NavigateObject(
      'Shopping list Scroll',
      ShoppingListPage.routeName,
    ),
    _NavigateObject(
      'Rating Card',
      RatingCard.routeName,
    ),
  ];

  Iterable<Widget> _batchRoute() => routeList.map(
        (one) => NavigateButton(
          navigationText: one.text,
          routeName: one.route,
        ),
      );

  @override
  void initState() {
    super.initState();
    print(Navigator.defaultRouteName == '/'); // means true
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Stack(
        children: <Widget>[
          Column(
            children: <Widget>[
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    bottom: BorderSide(
                      color: Colors.purpleAccent,
                      width: 2.0,
                    ),
                  ),
                ),
                height: 60.0,
              ),
              Expanded(
                child: Scrollbar(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(vertical: 20.0),
                    children: <Widget>[
                      OpenSnack(),
                      NavigateButton(
                        navigationText: 'Open Tick Route',
                        builder: (BuildContext context) {
                          return TickRoute();
                        },
                      ),
                      NavigateButton(
                        navigationText: 'Open Score2 Route with value 65',
                        routeName: "/score2",
                        arguments: Score(65),
                      ),
                      NavigateButton(
                        navigationText: 'A full example Tabber',
                        fullscreenDialog: true,
                        builder: (BuildContext context) {
                          return TabberRoute();
                        },
                      ),
                      NavigateButton(
                        navigationText: 'Open Tick Route in dialog',
                        fullscreenDialog: true,
                        builder: (BuildContext context) {
                          return TickRoute();
                        },
                      ),
                    ]..addAll(
                        _batchRoute(),
                      ),
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            top: 10.0,
            right: 10.0,
            child: Container(
              padding: const EdgeInsets.all(10.0),
              decoration: BoxDecoration(
                color: Colors.orangeAccent,
                borderRadius: BorderRadius.all(Radius.circular(4.0)),
              ),
              child: Text.rich(
                TextSpan(
                  text: 'Positioned ',
                  style: TextStyle(
                    decoration: TextDecoration.lineThrough,
                  ),
                  children: <TextSpan>[
                    TextSpan(
                      text: 'SpanText',
                      style: TextStyle(
                        backgroundColor: Colors.cyan,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavigateObject {
  final String text;
  final String route;

  _NavigateObject(this.text, this.route);
}
