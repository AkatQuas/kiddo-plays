import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

class OfflineAsr {
  static final OfflineAsr _instance = OfflineAsr._internal();
  factory OfflineAsr() => _instance;
  OfflineAsr._internal();

  stt.SpeechToText? _speech;
  bool _isInitialized = false;
  bool _isListening = false;

  Future<void> initialize() async {
    if (_isInitialized) return;
    _speech = stt.SpeechToText();
    await _speech!.initialize(
      onError: (error) => debugPrint('ASR Error: $error'),
      onStatus: (status) => debugPrint('ASR Status: $status'),
    );
    _isInitialized = true;
  }

  bool get isListening => _isListening;

  Future<void> startListening({
    required Function(String) onResult,
    Function? onError,
    String localeId = 'zh_CN',
  }) async {
    if (!_isInitialized) await initialize();
    if (_isListening) return;

    _isListening = true;
    await _speech?.listen(
      onResult: (result) {
        if (result.finalResult) {
          onResult(result.recognizedWords);
        }
      },
      localeId: localeId,
      listenOptions: stt.SpeechListenOptions(
        listenMode: stt.ListenMode.dictation,
        cancelOnError: true,
        partialResults: false,
      ),
    );
  }

  Future<void> stopListening() async {
    _isListening = false;
    await _speech?.stop();
  }

  /// 模糊匹配算法 - 支持口语简称、同音、近似词匹配
  static int fuzzyMatch(String input, String target) {
    final inputLower = input.toLowerCase();
    final targetLower = target.toLowerCase();

    // 完全匹配
    if (inputLower == targetLower) return 100;

    // 包含匹配
    if (targetLower.contains(inputLower) || inputLower.contains(targetLower)) {
      return 80;
    }

    // 开头匹配
    if (targetLower.startsWith(inputLower)) {
      return 90;
    }

    // 关键词匹配（取最长匹配）
    final inputChars = inputLower.split('');
    int matchCount = 0;
    int lastMatchIndex = -1;
    for (final char in inputChars) {
      final index = targetLower.indexOf(char, lastMatchIndex + 1);
      if (index >= 0) {
        matchCount++;
        lastMatchIndex = index;
      }
    }
    if (matchCount > 0) {
      return (matchCount * 100 / inputChars.length).round();
    }

    // 相似度计算（编辑距离）
    final distance = _levenshteinDistance(inputLower, targetLower);
    final maxLen = inputLower.length > targetLower.length ? inputLower.length : targetLower.length;
    final similarity = ((maxLen - distance) / maxLen * 100).round();
    return similarity > 30 ? similarity : 0;
  }

  static int _levenshteinDistance(String s1, String s2) {
    if (s1.isEmpty) return s2.length;
    if (s2.isEmpty) return s1.length;

    List<int> v0 = List<int>.generate(s2.length + 1, (i) => i);
    List<int> v1 = List<int>.filled(s2.length + 1, 0);

    for (int i = 0; i < s1.length; i++) {
      v1[0] = i + 1;
      for (int j = 0; j < s2.length; j++) {
        int cost = s1[i] == s2[j] ? 0 : 1;
        v1[j + 1] = [v1[j] + 1, v0[j + 1] + 1, v0[j] + cost].reduce((a, b) => a < b ? a : b);
      }
      final temp = v0;
      v0 = v1;
      v1 = temp;
    }
    return v0[s2.length];
  }

  /// 从候选列表中找到最佳匹配
  static Map<String, dynamic>? findBestMatch(String input, List<Map<String, dynamic>> candidates) {
    if (input.isEmpty || candidates.isEmpty) return null;

    int bestScore = 0;
    Map<String, dynamic>? bestMatch;

    for (final candidate in candidates) {
      final name = candidate['name'] as String? ?? '';
      final score = fuzzyMatch(input, name);
      if (score > bestScore && score >= 30) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch != null) {
      bestMatch['matchScore'] = bestScore;
    }
    return bestMatch;
  }
}