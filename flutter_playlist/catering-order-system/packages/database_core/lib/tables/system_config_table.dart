import 'package:drift/drift.dart';

class SystemConfig extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get key => text().unique()();
  TextColumn get value => text()();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
}

// 配置键常量
class ConfigKeys {
  static const String shopName = 'shop_name';
  static const String adminPassword = 'admin_password';
  static const String paymentCode = 'payment_code';
  static const String printerConfig = 'printer_config';
  static const String biometricEnabled = 'biometric_enabled';
  static const String lastArchiveDate = 'last_archive_date';
  static const String archiveLockTime = 'archive_lock_time';
  static const String tableCount = 'table_count';
}