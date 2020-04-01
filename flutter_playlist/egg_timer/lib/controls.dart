import 'package:egg_timer/egg_timer.dart';
import 'package:flutter/material.dart';
import './control_button.dart';

class Controls extends StatefulWidget {
  final EggTimerState eggTimerState;
  final Function onPaused;
  final Function onResume;
  final Function onRestart;
  final Function onReset;

  const Controls({
    Key key,
    this.eggTimerState,
    this.onPaused,
    this.onRestart,
    this.onResume,
    this.onReset,
  }) : super(key: key);

  @override
  _ControlsState createState() => _ControlsState();
}

class _ControlsState extends State<Controls> with TickerProviderStateMixin {
  bool get _stateIsRunning => widget.eggTimerState == EggTimerState.running;

  _pauseOrResume() {
    if (_stateIsRunning) {
      widget.onPaused();
    } else {
      widget.onResume();
    }
  }

  AnimationController pauseResumeSlideController;
  AnimationController restartResetSlideController;

  @override
  void initState() {
    super.initState();
    pauseResumeSlideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    )..addListener(() => setState(() {}));
    pauseResumeSlideController.value = 1.0;

    restartResetSlideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    )..addListener(() => setState(() {}));
    restartResetSlideController.value = 1.0;
  }

  @override
  void dispose() {
    pauseResumeSlideController.dispose();
    restartResetSlideController.dispose();
    super.dispose();
  }

  _decideAnimationController() {
    switch (widget.eggTimerState) {
      case EggTimerState.ready:
        pauseResumeSlideController.forward();
        restartResetSlideController.forward();
        break;
      case EggTimerState.running:
        pauseResumeSlideController.reverse();
        restartResetSlideController.forward();
        break;
      case EggTimerState.paused:
        pauseResumeSlideController.reverse();
        restartResetSlideController.reverse();
        break;
      case EggTimerState.done:
        pauseResumeSlideController.forward();
        restartResetSlideController.reverse();
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    _decideAnimationController();
    return Column(
      children: <Widget>[
        Opacity(
          opacity: 1.0 - restartResetSlideController.value,
          child: Row(
            children: <Widget>[
              ControlButton(
                icon: Icons.refresh,
                text: 'Restart',
                onPressed: widget.onRestart,
              ),
              Expanded(
                child: Container(),
              ),
              ControlButton(
                icon: Icons.timer,
                text: 'Reset',
                onPressed: widget.onReset,
              ),
            ],
          ),
        ),
        Transform(
          transform: Matrix4.translationValues(
            0,
            100 * (pauseResumeSlideController.value),
            0,
          ),
          child: ControlButton(
            icon: _stateIsRunning ? Icons.pause : Icons.play_arrow,
            text: _stateIsRunning ? 'Pause' : 'Resume',
            color: Colors.white24,
            onPressed: _pauseOrResume,
          ),
        ),
      ],
    );
  }
}
