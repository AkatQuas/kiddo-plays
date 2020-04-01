import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import '../generic/radial_position.dart';

class RadialList extends StatelessWidget {
  final RadialListViewModel list;
  final SlideRadialListController controller;

  RadialList({
    Key key,
    this.list,
    this.controller,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (BuildContext context, Widget child) {
        return Stack(
          children: _radialItems(),
        );
      },
    );
  }

  List<Widget> _radialItems() {
    final List<Widget> result = [];
    for (var i = 0; i < list.items.length; i++) {
      final item = list.items[i];
      final currentAngle = controller.getAngle(i);
      result.add(
        Transform(
          transform: Matrix4.translationValues(
            40.0,
            334.0,
            0.0,
          ),
          child: RadialPosition(
            radius: 140.0 + 75.0,
            angle: currentAngle,
            child: Opacity(
              opacity: controller.opacity,
              child: RadialListItem(
                item: item,
              ),
            ),
          ),
        ),
      );
    }
    return result;
  }
}

class RadialListItem extends StatelessWidget {
  final RadialListItemViewModel item;

  RadialListItem({
    Key key,
    this.item,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final circleDecrotation = item.isSelected
        ? const BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
          )
        : BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.transparent,
            border: Border.all(
              color: Colors.white,
              width: 2.0,
            ),
          );
    return Transform(
      transform: Matrix4.translationValues(-30.0, -30.0, 0.0),
      child: Row(
        children: <Widget>[
          Container(
            width: 60.0,
            height: 60.0,
            decoration: circleDecrotation,
            child: Padding(
              padding: const EdgeInsets.all(7.0),
              child: Image(
                image: item.icon,
                color: item.isSelected ? const Color(0xFF6688CC) : Colors.white,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 5.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  item.title,
                  style: TextStyle(
                    fontSize: 18.0,
                  ),
                ),
                Text(item.subtitle),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class RadialListViewModel {
  final List<RadialListItemViewModel> items;

  RadialListViewModel({
    this.items = const [],
  });
}

class RadialListItemViewModel {
  final ImageProvider icon;
  final String title;
  final String subtitle;
  final bool isSelected;

  RadialListItemViewModel({
    this.icon,
    this.title = '',
    this.subtitle = '',
    this.isSelected = false,
  });
}

class SlideRadialListController extends ChangeNotifier {
  final startAngle = -pi / 3;
  final endAngle = pi / 3;
  final slidingStartAngle = 3 * pi / 4;

  final AnimationController _slideController;
  final AnimationController _fadeController;
  final int itemCount;
  final List<Animation<double>> _slidePositions = [];
  RadialListState _state = RadialListState.closed;

  Completer<Null> _onOpenedCompleter;
  Completer<Null> _onClosedCompleter;

  SlideRadialListController({
    vsync,
    this.itemCount,
  })  : _slideController = AnimationController(
          vsync: vsync,
          duration: Duration(milliseconds: 1500),
        ),
        _fadeController = AnimationController(
          vsync: vsync,
          duration: Duration(milliseconds: 150),
        ) {
    _slideController
      ..addListener(notifyListeners)
      ..addStatusListener((AnimationStatus status) {
        switch (status) {
          case AnimationStatus.forward:
            _state = RadialListState.opening;
            break;
          case AnimationStatus.completed:
            _state = RadialListState.open;
            _onOpenedCompleter.complete();
            break;
          default:
            break;
        }
      });
    _fadeController
      ..addListener(notifyListeners)
      ..addStatusListener((AnimationStatus status) {
        switch (status) {
          case AnimationStatus.forward:
            _state = RadialListState.closing;
            break;
          case AnimationStatus.completed:
            _state = RadialListState.closed;
            _slideController.value = 0.0;
            _fadeController.value = 0.0;
            _onClosedCompleter.complete();
            break;
          default:
            break;
        }
      });

    final delayInterval = 0.05;
    final slideDuration = 0.4;
    final angleStep = (endAngle - startAngle) / (itemCount - 1);
    for (var i = 0; i < itemCount; i++) {
      final start = delayInterval * i;
      final end = start + slideDuration;

      final endSlideAngle = startAngle + (angleStep * i);
      _slidePositions.add(
        Tween(begin: slidingStartAngle, end: endSlideAngle).animate(
          CurvedAnimation(
              parent: _slideController,
              curve: Interval(
                start,
                end,
                curve: Curves.easeInOut,
              )),
        ),
      );
    }
  }

  @override
  dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  double getAngle(int index) {
    return _slidePositions[index].value;
  }

  double get opacity {
    switch (_state) {
      case RadialListState.closed:
        return 0.0;
      case RadialListState.opening:
        return _slideController.value;
      case RadialListState.open:
        return 1.0;
      case RadialListState.closing:
        return (1 - _fadeController.value);
    }
    return 1.0;
  }

  Future<Null> open() {
    if (_state == RadialListState.closed) {
      _slideController.forward();
      _onOpenedCompleter = new Completer();
      return _onOpenedCompleter.future;
    }
    return null;
  }

  Future<Null> close() {
    if (_state == RadialListState.open) {
      _fadeController.forward();
      _onClosedCompleter = new Completer();
      return _onClosedCompleter.future;
    }
    return null;
  }
}

enum RadialListState {
  open,
  opening,
  closed,
  closing,
}
