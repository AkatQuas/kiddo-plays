import 'package:drift/drift.dart';

class DishDailyStatistics extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get dishId => integer()();
  TextColumn get dishName => text()();
  DateTimeColumn get statDate => dateTime()();
  IntColumn get soldCount => integer().withDefault(const Constant(0))();
  IntColumn get revenue => integer().withDefault(const Constant(0))();  // 单位：分
  IntColumn get refundCount => integer().withDefault(const Constant(0))();
  IntColumn get refundAmount => integer().withDefault(const Constant(0))();  // 单位：分
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  List<String> get customConstraints => ['UNIQUE(dish_id, stat_date)'];
}