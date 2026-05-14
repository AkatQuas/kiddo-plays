import 'package:drift/drift.dart';

class Dishes extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text().withLength(min: 1, max: 100)();
  IntColumn get price => integer()();  // 单位：分
  TextColumn get imagePath => text().nullable()();
  TextColumn get status => text().withDefault(const Constant('available'))();  // available, sold_out, disabled
  IntColumn get stock => integer().withDefault(const Constant(100))();
  IntColumn get soldCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  BoolColumn get isDeleted => boolean().withDefault(const Constant(false))();
}