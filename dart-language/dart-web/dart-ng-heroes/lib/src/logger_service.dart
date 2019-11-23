class Logger {
  List<String> _log = [];
  String get id => 'Logger';

  void log(String msg) {
    _log.add(msg);
    print(msg);
  }
  void logAll() {
    print(_log.join('\n'));
  }

  @override
  String toString() => '[$id] $_log';
}

// logging package