import 'dart:async';
import 'package:flutter/foundation.dart';

enum AppMode { order, management }

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  AppMode _currentMode = AppMode.order;
  DateTime? _lastActivityTime;
  Timer? _timeoutTimer;
  bool _isBiometricEnabled = false;

  static const int managementModeTimeoutMinutes = 5;

  AppMode get currentMode => _currentMode;
  bool get isManagementMode => _currentMode == AppMode.management;
  bool get isOrderMode => _currentMode == AppMode.order;
  DateTime? get lastActivityTime => _lastActivityTime;
  bool get isBiometricEnabled => _isBiometricEnabled;

  void initialize({bool biometricEnabled = false}) {
    _isBiometricEnabled = biometricEnabled;
    _resetActivityTimer();
  }

  void _resetActivityTimer() {
    _lastActivityTime = DateTime.now();
    _timeoutTimer?.cancel();
    if (_currentMode == AppMode.management) {
      _timeoutTimer = Timer(
        Duration(minutes: managementModeTimeoutMinutes),
        () {
          switchToOrderMode();
        },
      );
    }
  }

  void recordActivity() {
    _resetActivityTimer();
  }

  bool verifyPassword(String input, String storedHash) {
    // 简化版本：直接比较（生产环境应使用加密）
    return input == storedHash;
  }

  Future<bool> switchToManagementMode(String password, String storedHash) async {
    if (verifyPassword(password, storedHash)) {
      _currentMode = AppMode.management;
      _resetActivityTimer();
      notifyListeners();
      return true;
    }
    return false;
  }

  void switchToOrderMode() {
    _currentMode = AppMode.order;
    _timeoutTimer?.cancel();
    _lastActivityTime = null;
    notifyListeners();
  }

  void toggleMode(String password, String storedHash) async {
    if (_currentMode == AppMode.order) {
      await switchToManagementMode(password, storedHash);
    } else {
      switchToOrderMode();
    }
  }

  void setBiometricEnabled(bool enabled) {
    _isBiometricEnabled = enabled;
    notifyListeners();
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }
}