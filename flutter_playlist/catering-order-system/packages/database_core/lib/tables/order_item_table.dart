import 'package:drift/drift.dart';
import 'order_table.dart';

class OrderItems extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get orderId => integer().references(Orders, #id)();
  IntColumn get dishId => integer()();
  TextColumn get dishName => text()();
  IntColumn get unitPrice => integer()();  // 单位：分
  IntColumn get quantity => integer()();
  IntColumn get subtotal => integer()();  // 单位：分
}