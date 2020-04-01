import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class ProgressIndicatorRoute extends StatefulWidget {
  static const routeName = "/progress_indicator";

  @override
  _ProgressIndicatorRouteState createState() => _ProgressIndicatorRouteState();
}

class _ProgressIndicatorRouteState extends State<ProgressIndicatorRoute> {
  bool _switchSelected = false;
  bool _checkBoxSelected = false;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Progress indicator',
        ),
      ),
      body: Center(
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: LinearProgressIndicator(
                backgroundColor: Colors.grey[200],
                valueColor: AlwaysStoppedAnimation(Colors.red),
                semanticsLabel: "what",
                semanticsValue: "0.8",
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: LinearProgressIndicator(
                backgroundColor: Colors.grey[200],
                valueColor: AlwaysStoppedAnimation(Colors.blue),
                value: .8,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: SizedBox(
                height: 50.0,
                width: 50.0,
                child: CircularProgressIndicator(
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation(Colors.greenAccent),
                  strokeWidth: 8.0,
                ),
              ),
            ),
            Container(
              width: double.infinity,
              height: 100.0,
              padding: const EdgeInsets.all(8.0),
              child: CircularProgressIndicator(
                backgroundColor: Colors.grey[200],
                valueColor: AlwaysStoppedAnimation(Colors.blue),
                value: .5,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: AutofillIndicator(),
            ),
            Container(
              padding: const EdgeInsets.all(8.0),
              width: 100.0,
              height: 100.0,
              child: AutofillIndicator(
                type: "circular",
                endColor: Colors.red,
              ),
            ),
            TwoWayProgressor(),
          ],
        ),
      ),
    );
  }
}

class TwoWayProgressor extends StatefulWidget {
  const TwoWayProgressor({
    Key key,
  }) : super(key: key);

  @override
  _TwoWayProgressorState createState() => _TwoWayProgressorState();
}

class _TwoWayProgressorState extends State<TwoWayProgressor> {
  double _value = 0.5;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Container(
          color: Colors.amber,
          height: 1,
        ),
        Text('Please slide the slider'),
        CupertinoSlider(
          value: _value,
          onChanged: (double v) {
            setState(() {
              _value = v;
            });
          },
        ),
        Container(
          width: 100.0,
          height: 100.0,
          padding: const EdgeInsets.all(8.0),
          child: CircularProgressIndicator(
            value: _value,
            backgroundColor: Colors.grey[200],
            valueColor: AlwaysStoppedAnimation(Colors.blue),
          ),
        ),
      ],
    );
  }
}

class AutofillIndicator extends StatefulWidget {
  final Color beginColor;
  final Color endColor;
  final Color backgroundColor;
  final String type;
  final Duration duration;

  const AutofillIndicator({
    Key key,
    this.backgroundColor = Colors.grey,
    this.beginColor = Colors.grey,
    this.endColor = Colors.blue,
    this.type = "linear",
    this.duration = const Duration(
      seconds: 2,
      milliseconds: 500,
    ),
  })  : assert(type == "linear" || type == "circular",
            '"Type" should be either "linear" or "circular"'),
        super(key: key);
  @override
  _AutofillIndicatorState createState() => _AutofillIndicatorState();
}

class _AutofillIndicatorState extends State<AutofillIndicator>
    with SingleTickerProviderStateMixin {
  AnimationController _animationController;
  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      vsync: this,
      duration: widget.duration,
    )
      ..addListener(() => setState(() => {}))
      ..addStatusListener((AnimationStatus status) {
        if (status == AnimationStatus.completed) {
          this._clearAndStart();
        }
      });
    _clearAndStart();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  _clearAndStart() {
    _animationController.value = 0.0;
    _animationController.forward();
  }

  _chooseType() {
    if (widget.type == "linear") {
      return LinearProgressIndicator(
        backgroundColor: widget.backgroundColor,
        valueColor: ColorTween(
          begin: widget.beginColor,
          end: widget.endColor,
        ).animate(_animationController), // 从灰色变成蓝色
        value: _animationController.value,
      );
    }
    return CircularProgressIndicator(
      backgroundColor: widget.backgroundColor,
      valueColor: ColorTween(
        begin: widget.beginColor,
        end: widget.endColor,
      ).animate(_animationController), // 从灰色变成蓝色
      value: _animationController.value,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(16),
      child: _chooseType(),
    );
  }
}
