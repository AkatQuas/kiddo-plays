import 'dart:io';
import 'package:path/path.dart' as p;

String getDataDir() {
  final exePath = Platform.script.toFilePath();
  return p.dirname(exePath);
}