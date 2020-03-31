import 'dart:async';

import 'package:flutter/material.dart';

import './page_dragger.dart';
import './page_reveal.dart';
import './pager_indicator.dart';
import './pages.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Paper Onboarding',
      theme: ThemeData(
        fontFamily: 'FlamanteRoma',
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> with TickerProviderStateMixin {
  final StreamController<SlideUpdate> slideUpdateStream = StreamController();

  AnimatedPageDragger animatedPageDragger;
  int activeIndex = 0;
  int nextIndex = 0;
  SlideDirection slideDirection = SlideDirection.none;
  double slidePercent = 0.0;

  _MyHomePageState() {
    slideUpdateStream.stream.listen((SlideUpdate event) {
      setState(() {
        if (event.type == UpdateType.dragging ||
            event.type == UpdateType.animating) {
          print("${event.type} ${event.direction} ${event.percent}");
          slideDirection = event.direction;
          slidePercent = event.percent;
          nextIndex = slideDirection == SlideDirection.leftToRight
              ? activeIndex - 1
              : (slideDirection == SlideDirection.rightToLeft
                  ? activeIndex + 1
                  : activeIndex);
          nextIndex = nextIndex.clamp(0.0, pages.length - 1);
        } else if (event.type == UpdateType.doneDragging) {
          final goal =
              slidePercent > 0.5 ? TransitionGoal.open : TransitionGoal.close;
          animatedPageDragger = AnimatedPageDragger(
            slideDirection: slideDirection,
            transitionGoal: goal,
            slidePercent: slidePercent,
            slideUpdateStream: slideUpdateStream,
            vsync: this,
          );
          animatedPageDragger.run();
        } else if (event.type == UpdateType.doneAnimating) {
          var targetStep = 0;
          if (slidePercent > 0.5) {
            targetStep = slideDirection == SlideDirection.leftToRight
                ? -1
                : (slideDirection == SlideDirection.rightToLeft ? 1 : 0);
          }
          activeIndex = (activeIndex + targetStep) % pages.length;
          slideDirection = SlideDirection.none;
          slidePercent = 0.0;
          animatedPageDragger.dispose();
        }
      });
    });
  }

  @override
  void dispose() {
    slideUpdateStream.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Stack(
          children: <Widget>[
            Page(
              viewModel: pages[activeIndex],
              percentVisible: 1.0,
            ),
            PageReveal(
              revealPercent: slidePercent,
              child: Page(
                viewModel: pages[nextIndex],
                percentVisible: slidePercent,
              ),
            ),
            PagerIndicator(
              viewModel: PagerIndicatorViewModel(
                pages,
                activeIndex,
                slideDirection,
                slidePercent,
              ),
            ),
            PageDragger(
              slideUpdateStream: slideUpdateStream,
              canDragLeftToRight: activeIndex > 0,
              canDragRightToLeft: activeIndex < pages.length - 1,
            ),
          ],
        ),
      ),
    );
  }
}
