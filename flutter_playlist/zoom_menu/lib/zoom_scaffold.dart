import 'package:flutter/material.dart';

import './screen.dart';

class ZoomScaffold extends StatefulWidget {
  final Screen contentScreen;
  final Widget menuScreen;

  const ZoomScaffold({
    Key key,
    this.contentScreen,
    this.menuScreen,
  }) : super(key: key);
  @override
  _ZoomScaffoldState createState() => _ZoomScaffoldState();
}

class _ZoomScaffoldState extends State<ZoomScaffold>
    with TickerProviderStateMixin {
  ZoomScaffoldController _zoomScaffoldController;
  Curve scaleDownCurve = const Interval(0, 0.3, curve: Curves.easeOut);
  Curve scaleUpwnCurve = const Interval(0, 1.0, curve: Curves.easeOut);
  Curve slideOutCurve = const Interval(0, 1.0, curve: Curves.easeOut);
  Curve slideInCurve = const Interval(0, 1.0, curve: Curves.easeOut);

  @override
  void initState() {
    super.initState();
    _zoomScaffoldController = ZoomScaffoldController(vsync: this)
      ..addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _zoomScaffoldController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        widget.menuScreen,
        _createContentDisplay(context),
      ],
    );
  }

  Widget _zoomAndSlide(Widget content) {
    final percent = _zoomScaffoldController.openPercent;
    double slidePercent, scalePercent;
    switch (_zoomScaffoldController.state) {
      case ZoomScaffoldState.closed:
        slidePercent = 0.0;
        scalePercent = 0.0;
        break;
      case ZoomScaffoldState.open:
        slidePercent = 1.0;
        scalePercent = 1.0;
        break;
      case ZoomScaffoldState.opening:
        slidePercent = slideOutCurve.transform(percent);
        scalePercent = scaleDownCurve.transform(percent);
        break;
      case ZoomScaffoldState.closing:
        slidePercent = slideInCurve.transform(percent);
        scalePercent = scaleUpwnCurve.transform(percent);
        break;
      default:
    }

    return Transform(
      transform: Matrix4.translationValues(
        275.0 * slidePercent,
        0.0,
        0.0,
      )..scale(
          1 - 0.15 * scalePercent,
        ),
      child: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: const Color(0x44000000),
              offset: const Offset(0.0, 5.0),
              blurRadius: 20.0,
              spreadRadius: 10.0,
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10.0 * percent),
          child: content,
        ),
      ),
      alignment: Alignment.centerLeft,
    );
  }

  Widget _createContentDisplay(BuildContext context) {
    return _zoomAndSlide(
      Container(
        decoration: BoxDecoration(
          image: widget.contentScreen.background,
        ),
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            elevation: 0.0,
            leading: IconButton(
              icon: Icon(Icons.menu),
              onPressed: () {
                _zoomScaffoldController.toggle();
              },
            ),
            backgroundColor: Colors.transparent,
            title: Text(
              widget.contentScreen.title,
              style: TextStyle(
                fontFamily: 'BebasNenu',
                fontSize: 25.0,
              ),
            ),
          ),
          body: widget.contentScreen.contentBuilder(context),
        ),
      ),
    );
  }
}

class ZoomScaffoldMenuController extends StatefulWidget {
  final ZoomScaffoldBuilder builder;

  const ZoomScaffoldMenuController({
    Key key,
    this.builder,
  }) : super(key: key);

  @override
  _ZoomScaffoldMenuControllerState createState() =>
      _ZoomScaffoldMenuControllerState();
}

class _ZoomScaffoldMenuControllerState
    extends State<ZoomScaffoldMenuController> {
  ZoomScaffoldController _zoomScaffoldController;

  @override
  void initState() {
    super.initState();
    _zoomScaffoldController = _getZoomScaffoldController(context);
    _zoomScaffoldController.addListener(_onZoomScaffoldControllerChange);
  }

  @override
  void dispose() {
    _zoomScaffoldController.removeListener(_onZoomScaffoldControllerChange);
    super.dispose();
  }

  _onZoomScaffoldControllerChange() {
    setState(() {});
  }

  _getZoomScaffoldController(BuildContext context) {
    final scaffoldState = context.findAncestorStateOfType<_ZoomScaffoldState>();
    return scaffoldState._zoomScaffoldController;
  }

  @override
  Widget build(BuildContext context) {
    return widget.builder(
      context,
      _zoomScaffoldController,
    );
  }
}

typedef Widget ZoomScaffoldBuilder(
  BuildContext context,
  ZoomScaffoldController zoomScaffoldController,
);

class ZoomScaffoldController extends ChangeNotifier {
  final TickerProvider vsync;
  final AnimationController _animationController;
  ZoomScaffoldState _state = ZoomScaffoldState.closed;

  ZoomScaffoldController({
    @required this.vsync,
  }) : _animationController = AnimationController(
          vsync: vsync,
          duration: const Duration(milliseconds: 250),
        ) {
    _animationController
      ..addListener(() {
        // print('listener ${_animationController.value}');
        notifyListeners();
      })
      ..addStatusListener((AnimationStatus status) {
        switch (status) {
          case AnimationStatus.forward:
            _state = ZoomScaffoldState.opening;
            break;
          case AnimationStatus.reverse:
            _state = ZoomScaffoldState.closing;
            break;
          case AnimationStatus.completed:
            _state = ZoomScaffoldState.open;
            break;
          case AnimationStatus.dismissed:
            _state = ZoomScaffoldState.closed;
            break;
          default:
        }
        // print('Statuslistener ${_animationController.value} at $status');
        notifyListeners();
      });
  }

  ZoomScaffoldState get state => _state;

  double get openPercent => _animationController.value;

  @override
  dispose() {
    _animationController.dispose();
    super.dispose();
  }

  open() {
    _animationController.forward();
  }

  close() {
    _animationController.reverse();
  }

  toggle() {
    if (_state == ZoomScaffoldState.closed) {
      open();
    } else if (_state == ZoomScaffoldState.open) {
      close();
    }
  }
}

enum ZoomScaffoldState {
  closed,
  opening,
  open,
  closing,
}
