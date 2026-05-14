import 'package:drift/drift.dart';

class DailyStatistics extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get statDate => dateTime()();
  IntColumn get orderCount => integer().withDefault(const Constant(0))();
  IntColumn get totalRevenue => integer().withDefault(const Constant(0))();  // 单位：分
  IntColumn get refundCount => integer().withDefault(const Constant(0))();
  IntColumn get refundAmount => integer().withDefault(const Constant(0))();  // 单位：分
  IntColumn get netRevenue => integer().withDefault(const Constant(0))();  // 单位：分
  RealColumn get avgOrderAmount => real().withDefault(const Constant(0.0))();
  IntColumn get completedCount => integer().withDefault(const Constant(0))();
  IntColumn get pendingCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  List<String> get customConstraints => ['UNIQUE(stat_date)'];
}