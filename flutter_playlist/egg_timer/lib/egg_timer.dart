import 'dart:async';

final Duration _timeZero = const Duration(seconds: 0);

class EggTimer {
  final Duration maxTime;
  Duration _selectionTime = _timeZero;
  Duration _currentTime = _timeZero;
  final Stopwatch _stopwatch = Stopwatch();
  Timer _timer;
  EggTimerState state = EggTimerState.ready;
  final Function(Duration) onTimerUpdate;

  EggTimer({
    this.maxTime,
    this.onTimerUpdate,
  });

  Duration get selectionTime => _selectionTime;
  set selectionTime(Duration time) {
    if (state == EggTimerState.ready) {
      _selectionTime = time;
      _currentTime = time;
    }
  }

  Duration get currentTime => _currentTime;

  start() {
    if (state == EggTimerState.ready && _selectionTime != null) {
      state = EggTimerState.running;
      _selectionTime = Duration(minutes: _selectionTime.inMinutes, seconds: 1);
      _stopwatch.reset();
      _stopwatch.start();
      _tick();
    }
  }

  resume() {
    if (state == EggTimerState.paused) {
      print("current state $state");
      state = EggTimerState.running;
      _stopwatch.start();
      _tick();
    }
  }

  pause() {
    if (state != EggTimerState.running) {
      return;
    }
    _clearTimer();
    _stopwatch.stop();
    state = EggTimerState.paused;
  }

  _tick() {
    if (_currentTime.inSeconds > 0) {
      _timer = Timer(Duration(seconds: 1), _tick);
      _currentTime = _selectionTime - _stopwatch.elapsed;
      print("_currentTime ${_currentTime.inSeconds}");
    } else {
      _clearTimer();
      state = EggTimerState.done;
    }
    if (null != _currentTime) {
      onTimerUpdate(_currentTime);
    }
  }

  _clearTime() {
    _currentTime = _timeZero;
    _selectionTime = _timeZero;
  }

  _clearTimer() {
    if (_timer != null) {
      _timer.cancel();
    }
  }

  reset() {
    if (state == EggTimerState.paused || state == EggTimerState.done) {
      _clearTimer();
      _clearTime();
      state = EggTimerState.ready;
    }
  }

  restart() {
    if (state == EggTimerState.paused || state == EggTimerState.done) {
      _clearTimer();
      _currentTime = _selectionTime;
      state = EggTimerState.ready;
      start();
    }
  }
}

enum EggTimerState {
  ready,
  running,
  paused,
  done,
}
