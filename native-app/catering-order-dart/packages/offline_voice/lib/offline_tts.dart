import 'package:flutter_tts/flutter_tts.dart';

class OfflineTts {
  static final OfflineTts _instance = OfflineTts._internal();
  factory OfflineTts() => _instance;
  OfflineTts._internal();

  FlutterTts? _flutterTts;
  bool _isInitialized = false;

  Future<void> initialize() async {
    if (_isInitialized) return;
    _flutterTts = FlutterTts();
    await _flutterTts!.setLanguage('zh-CN');
    await _flutterTts!.setSpeechRate(0.5);
    await _flutterTts!.setVolume(1.0);
    await _flutterTts!.setPitch(1.0);
    _isInitialized = true;
  }

  Future<void> speak(String text) async {
    if (!_isInitialized) await initialize();
    await _flutterTts?.speak(text);
  }

  Future<void> stop() async {
    await _flutterTts?.stop();
  }

  Future<void> setSpeechRate(double rate) async {
    await _flutterTts?.setSpeechRate(rate);
  }

  // 常用播报
  Future<void> announceNewOrder(String orderNumber) async {
    await speak('新订单 $orderNumber');
  }

  Future<void> announcePaymentReceived() async {
    await speak('收款成功');
  }

  Future<void> announceOrderReady(String orderNumber) async {
    await speak('订单 $orderNumber 已完成');
  }

  Future<void> announceOrderRefunded(String orderNumber) async {
    await speak('订单 $orderNumber 已退款');
  }

  Future<void> announceStockLow(String dishName) async {
    await speak('$dishName 库存不足');
  }
}