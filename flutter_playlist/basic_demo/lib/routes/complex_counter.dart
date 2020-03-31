import 'package:flutter/material.dart';

class ComplexCounter extends StatelessWidget {
  static const routeName = "/complex-counter";
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Complex Counter'),
      ),
      body: _Counter(10),
    );
  }
}

class _Counter extends StatefulWidget {
  _Counter(
    this.initialValue, {
    this.step,
  });

  final int initialValue;
  final int step;

  @override
  _CounterState createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  @override
  void initState() {
    super.initState();
    this._counter = widget.initialValue ?? 0;
    if (widget.step == null) {
      print('hello');
      this.step = 2;
    } else {
      this.step = widget.step;
    }
  }

  int _counter;
  int step;

  void _increment() {
    setState(() {
      _counter += step;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        _CounterIncrementor(_increment),
        _CounterDisplay(_counter),
      ],
    );
  }
}

class _CounterDisplay extends StatelessWidget {
  _CounterDisplay(this.count);

  final int count;

  @override
  Widget build(BuildContext context) {
    return Text('Count: $count');
  }
}

class _CounterIncrementor extends StatelessWidget {
  _CounterIncrementor(this.onPressed);

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return RaisedButton(
      onPressed: onPressed,
      child: Text('Increment'),
    );
  }
}
