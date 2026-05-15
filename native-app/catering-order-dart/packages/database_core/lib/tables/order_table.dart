import 'package:drift/drift.dart';

class Orders extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get orderNumber => text().unique()();  // 订单编号
  TextColumn get status => text().withDefault(const Constant('pending'))();  // pending, paid, cooking, completed, refunded
  IntColumn get totalAmount => integer()();  // 单位：分
  IntColumn get discountAmount => integer().withDefault(const Constant(0))();  // 单位：分
  IntColumn get finalAmount => integer()();  // 单位：分
  TextColumn get tableNumber => text().nullable()();  // 桌号 (如 "1", "2", "自由")
  TextColumn get remark => text().nullable()();
  IntColumn get cartIndex => integer().withDefault(const Constant(0))();  // 购物车索引 (0或1)
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get completedAt => dateTime().nullable()();
}