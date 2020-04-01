import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

import './pager_indicator.dart';

class PageDragger extends StatefulWidget {
  final StreamController<SlideUpdate> slideUpdateStream;
  final bool canDragLeftToRight;
  final bool canDragRightToLeft;

  PageDragger({
    @required this.slideUpdateStream,
    this.canDragLeftToRight = false,
    this.canDragRightToLeft = false,
  });

  @override
  _PageDraggerState createState() => _PageDraggerState();
}

class _PageDraggerState extends State<PageDragger> {
  static const FULLTRANSITION = 300.0;

  Offset dragStart;
  SlideDirection slideDirection;
  double slidePercent;

  onDragStart(DragStartDetails details) {
    dragStart = details.globalPosition;
  }

  onDragUpdate(DragUpdateDetails details) {
    if (dragStart != null) {
      final newPosition = details.globalPosition;
      final dx = dragStart.dx - newPosition.dx;
      if (dx > 0.0 && widget.canDragRightToLeft) {
        slideDirection = SlideDirection.rightToLeft;
      } else if (dx < 0.0 && widget.canDragLeftToRight) {
        slideDirection = SlideDirection.leftToRight;
      } else {
        slideDirection = SlideDirection.none;
      }

      if (slideDirection != SlideDirection.none) {
        slidePercent = (dx / FULLTRANSITION).abs().clamp(0.0, 1.0);
      } else {
        slidePercent = 0.0;
      }

      widget.slideUpdateStream.add(
        SlideUpdate(
          UpdateType.dragging,
          slideDirection,
          slidePercent,
        ),
      );
      // print('Dragging $slideDirection at $slidePercent');
    }
  }

  onDragEnd(DragEndDetails details) {
    dragStart = null;
    widget.slideUpdateStream.add(
      SlideUpdate(
        UpdateType.doneDragging,
        SlideDirection.none,
        0.0,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onHorizontalDragStart: onDragStart,
      onHorizontalDragUpdate: onDragUpdate,
      onHorizontalDragEnd: onDragEnd,
    );
  }
}

class AnimatedPageDragger {
  static const PERCENT_PER_MS = 0.005;

  final SlideDirection slideDirection;
  final TransitionGoal transitionGoal;

  AnimationController completionAnimationController;

  AnimatedPageDragger({
    this.slideDirection,
    this.transitionGoal,
    slidePercent,
    StreamController<SlideUpdate> slideUpdateStream,
    TickerProvider vsync,
  }) {
    final startPercent = slidePercent;
    var endPercent;
    var duration;
    if (transitionGoal == TransitionGoal.open) {
      endPercent = 1.0;
      final slideRemaining = endPercent - slidePercent;
      duration = Duration(
        milliseconds: (slideRemaining / PERCENT_PER_MS).round(),
      );
    } else {
      endPercent = 0.0;
      duration = Duration(
        milliseconds: (slidePercent / PERCENT_PER_MS).round(),
      );
    }

    completionAnimationController = AnimationController(
      duration: duration,
      vsync: vsync,
    )
      ..addListener(() {
        slidePercent = lerpDouble(
          startPercent,
          endPercent,
          completionAnimationController.value,
        );
        slideUpdateStream.add(SlideUpdate(
          UpdateType.animating,
          slideDirection,
          slidePercent,
        ));
      })
      ..addStatusListener((AnimationStatus status) {
        if (status == AnimationStatus.completed) {
          slideUpdateStream.add(
            SlideUpdate(
              UpdateType.doneAnimating,
              slideDirection,
              endPercent,
            ),
          );
        }
      });
  }

  run() {
    completionAnimationController.forward(from: 0.0);
  }

  dispose() {
    completionAnimationController.dispose();
  }
}

enum TransitionGoal {
  open,
  close,
}

enum UpdateType {
  dragging,
  doneDragging,
  animating,
  doneAnimating,
}

class SlideUpdate {
  final SlideDirection direction;
  final double percent;
  final UpdateType type;

  SlideUpdate(
    this.type,
    this.direction,
    this.percent,
  );
}
