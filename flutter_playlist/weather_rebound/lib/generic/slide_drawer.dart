import 'package:flutter/material.dart';

class SlideDrawer extends StatelessWidget {
  final Widget content;
  final OpenableController openableController;

  SlideDrawer({
    Key key,
    @required this.content,
    @required this.openableController,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        // this is kind of overlay to capture tap event
        GestureDetector(
            onTap: openableController.isOpen ? openableController.close : null),
        FractionalTranslation(
            translation: Offset(
              1.0 - openableController.percent,
              0.0,
            ),
            child: Align(
              alignment: Alignment.centerRight,
              child: content,
            )),
      ],
    );
  }
}

class OpenableController extends ChangeNotifier {
  OpenableState _state = OpenableState.closed;
  AnimationController _animationController;
  OpenableController({
    @required TickerProvider vsync,
    @required Duration duration,
  }) : _animationController =
            AnimationController(vsync: vsync, duration: duration) {
    _animationController
      ..addListener(notifyListeners)
      ..addStatusListener((AnimationStatus status) {
        switch (status) {
          case AnimationStatus.forward:
            _state = OpenableState.opening;
            break;
          case AnimationStatus.completed:
            _state = OpenableState.open;
            break;

          case AnimationStatus.reverse:
            _state = OpenableState.closing;
            break;

          case AnimationStatus.dismissed:
            _state = OpenableState.closed;
            break;
        }
      });
  }

  OpenableState get state => _state;

  double get percent => _animationController.value;

  bool get isOpen => _state == OpenableState.open;
  bool get isOpening => _state == OpenableState.opening;
  bool get isClosed => _state == OpenableState.closed;
  bool get isClosing => _state == OpenableState.closing;

  void open() {
    _animationController.forward();
  }

  void close() {
    _animationController.reverse();
  }

  void toggle() {
    if (isOpen) {
      close();
    } else if (isClosed) {
      open();
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }
}

enum OpenableState {
  closed,
  closing,
  open,
  opening,
}
