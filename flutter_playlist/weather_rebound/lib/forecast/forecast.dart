import 'package:flutter/material.dart';

import './background/background_with_rings.dart';
import './background/rain.dart';
import './radial_list.dart';

class Forecast extends StatelessWidget {
  final RadialListViewModel forecastList;
  final SlideRadialListController slideRadialListController;

  Forecast({
    Key key,
    @required this.forecastList,
    @required this.slideRadialListController,
  }) : super(key: key);

  Widget _temperatureText() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(top: 140.0, left: 10.0),
        child: AnimatedBuilder(
          animation: slideRadialListController,
          builder: (BuildContext context, Widget child) {
            return Opacity(
              opacity: slideRadialListController.opacity,
              child: Transform(
                child: Text(
                  '68°',
                  style: TextStyle(
                    fontSize: 80.0,
                  ),
                ),
                transform: Matrix4.translationValues(
                  0.0,
                  10.0 * slideRadialListController.opacity,
                  0.0,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        BackgroundWithRings(),
        Rain(),
        _temperatureText(),
        RadialList(
          list: forecastList,
          controller: slideRadialListController,
        ),
      ],
    );
  }
}
