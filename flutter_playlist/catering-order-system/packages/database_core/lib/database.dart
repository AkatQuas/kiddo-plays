import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

import 'tables/dish_table.dart';
import 'tables/order_table.dart';
import 'tables/order_item_table.dart';
import 'tables/system_config_table.dart';
import 'tables/daily_statistics_table.dart';
import 'tables/dish_daily_statistics_table.dart';
import 'tables/archive_lock_table.dart';

part 'database.g.dart';

@DriftDatabase(tables: [
  Dishes,
  Orders,
  OrderItems,
  SystemConfig,
  DailyStatistics,
  DishDailyStatistics,
  ArchiveLock,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(
      onCreate: (Migrator m) async {
        await m.createAll();
        await _insertDefaultConfig();
      },
    );
  }

  Future<void> _insertDefaultConfig() async {
    await into(systemConfig).insert(
      SystemConfigCompanion.insert(
        key: ConfigKeys.shopName,
        value: '餐饮小店',
      ),
    );
    await into(systemConfig).insert(
      SystemConfigCompanion.insert(
        key: ConfigKeys.biometricEnabled,
        value: 'false',
      ),
    );
  }

  // ============ 菜品操作 ============

  Future<List<Dishe>> getAllDishes() {
    return (select(dishes)..where((t) => t.isDeleted.equals(false))).get();
  }

  Future<List<Dishe>> getAvailableDishes() {
    return (select(dishes)
          ..where((t) => t.isDeleted.equals(false) & t.status.equals('available'))
          ..orderBy([(t) => OrderingTerm.asc(t.name)]))
        .get();
  }

  Future<Dishe?> getDishById(int id) {
    return (select(dishes)..where((t) => t.id.equals(id))).getSingleOrNull();
  }

  Future<int> insertDish(DishesCompanion dish) {
    return into(dishes).insert(dish);
  }

  Future<bool> updateDish(Dishe dish) {
    return update(dishes).replace(dish);
  }

  Future<void> updateDishStatus(int dishId, String status) async {
    await (update(dishes)..where((t) => t.id.equals(dishId))).write(
      DishesCompanion(status: Value(status), updatedAt: Value(DateTime.now())),
    );
  }

  Future<void> updateDishDetails(int dishId, String name, int price, int stock) async {
    await (update(dishes)..where((t) => t.id.equals(dishId))).write(
      DishesCompanion(
        name: Value(name),
        price: Value(price),
        stock: Value(stock),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  Future<int> deleteDish(int id) {
    return (update(dishes)..where((t) => t.id.equals(id)))
        .write(const DishesCompanion(isDeleted: Value(true)));
  }

  Future<void> updateDishStock(int dishId, int quantity) async {
    final dish = await getDishById(dishId);
    if (dish != null) {
      final newStock = dish.stock - quantity;
      await (update(dishes)..where((t) => t.id.equals(dishId))).write(
        DishesCompanion(
          stock: Value(newStock < 0 ? 0 : newStock),
          status: Value(newStock <= 0 ? 'sold_out' : dish.status),
          updatedAt: Value(DateTime.now()),
        ),
      );
    }
  }

  Future<void> restoreDishStock(int dishId, int quantity) async {
    final dish = await getDishById(dishId);
    if (dish != null) {
      final newStock = dish.stock + quantity;
      await (update(dishes)..where((t) => t.id.equals(dishId))).write(
        DishesCompanion(
          stock: Value(newStock),
          status: Value(dish.status == 'sold_out' && newStock > 0 ? 'available' : dish.status),
          updatedAt: Value(DateTime.now()),
        ),
      );
    }
  }

  Future<void> markDishSoldOut(int dishId) {
    return (update(dishes)..where((t) => t.id.equals(dishId))).write(
      DishesCompanion(
        status: const Value('sold_out'),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  Future<void> restoreDishFromSoldOut(int dishId) {
    return (update(dishes)..where((t) => t.id.equals(dishId))).write(
      DishesCompanion(
        status: const Value('available'),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  // ============ 订单操作 ============

  Future<List<Order>> getTodayOrders() {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);
    return (select(orders)
          ..where((t) => t.createdAt.isBetweenValues(startOfDay, endOfDay))
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .get();
  }

  Future<List<Order>> getAllOrders({int? limit, int? offset}) {
    final query = select(orders)..orderBy([(t) => OrderingTerm.desc(t.createdAt)]);
    if (limit != null) query.limit(limit, offset: offset ?? 0);
    return query.get();
  }

  Future<Order?> getOrderById(int id) {
    return (select(orders)..where((t) => t.id.equals(id))).getSingleOrNull();
  }

  Future<int> insertOrder(OrdersCompanion order) {
    return into(orders).insert(order);
  }

  Future<bool> updateOrder(Order order) {
    return update(orders).replace(order);
  }

  Future<void> updateOrderStatus(int orderId, String status) async {
    final order = await getOrderById(orderId);
    if (order != null) {
      await (update(orders)..where((t) => t.id.equals(orderId))).write(
        OrdersCompanion(
          status: Value(status),
          updatedAt: Value(DateTime.now()),
          completedAt: status == 'completed' || status == 'refunded'
              ? Value(DateTime.now())
              : const Value.absent(),
        ),
      );
    }
  }

  Future<List<Order>> getOrdersByStatus(String status) {
    return (select(orders)..where((t) => t.status.equals(status))).get();
  }

  // ============ 订单项操作 ============

  Future<List<OrderItem>> getOrderItems(int orderId) {
    return (select(orderItems)..where((t) => t.orderId.equals(orderId))).get();
  }

  Future<int> insertOrderItem(OrderItemsCompanion item) {
    return into(orderItems).insert(item);
  }

  Future<void> insertOrderItems(List<OrderItemsCompanion> items) async {
    await batch((batch) {
      batch.insertAll(orderItems, items);
    });
  }

  // ============ 系统配置操作 ============

  Future<String?> getConfig(String key) async {
    final result = await (select(systemConfig)..where((t) => t.key.equals(key))).getSingleOrNull();
    return result?.value;
  }

  Future<void> setConfig(String key, String value) async {
    await into(systemConfig).insertOnConflictUpdate(
      SystemConfigCompanion.insert(
        key: key,
        value: value,
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  // ============ 归档统计操作 ============

  Future<DailyStatistic?> getDailyStatistic(DateTime date) {
    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59);
    return (select(dailyStatistics)
          ..where((t) => t.statDate.isBetweenValues(startOfDay, endOfDay)))
        .getSingleOrNull();
  }

  Future<List<DailyStatistic>> getDailyStatisticsList({DateTime? startDate, DateTime? endDate, int? limit}) {
    final query = select(dailyStatistics);
    if (startDate != null && endDate != null) {
      query.where((t) => t.statDate.isBetweenValues(startDate, endDate));
    }
    query.orderBy([(t) => OrderingTerm.desc(t.statDate)]);
    if (limit != null) query.limit(limit);
    return query.get();
  }

  Future<int> insertDailyStatistic(DailyStatisticsCompanion stat) {
    return into(dailyStatistics).insert(stat);
  }

  Future<void> updateDailyStatistic(int id, DailyStatisticsCompanion stat) {
    return (update(dailyStatistics)..where((t) => t.id.equals(id))).write(stat);
  }

  // ============ 菜品日统计操作 ============

  Future<List<DishDailyStatistic>> getDishDailyStatistics(DateTime date) {
    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59);
    return (select(dishDailyStatistics)
          ..where((t) => t.statDate.isBetweenValues(startOfDay, endOfDay))
          ..orderBy([(t) => OrderingTerm.desc(t.soldCount)]))
        .get();
  }

  Future<int> insertDishDailyStatistic(DishDailyStatisticsCompanion stat) {
    return into(dishDailyStatistics).insert(stat);
  }

  // ============ 归档锁操作 ============

  Future<bool> isArchiveLocked(DateTime date) async {
    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59);
    final lock = await (select(archiveLock)
          ..where((t) => t.lockDate.isBetweenValues(startOfDay, endOfDay)))
        .getSingleOrNull();
    return lock != null;
  }

  Future<void> lockArchive(DateTime date) async {
    final startOfDay = DateTime(date.year, date.month, date.day);
    await into(archiveLock).insert(
      ArchiveLockCompanion.insert(lockDate: startOfDay),
    );
  }

  // ============ 统计查询 ============

  Future<Map<String, int>> getTodaySummary() async {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);

    final todayOrders = await (select(orders)
          ..where((t) => t.createdAt.isBetweenValues(startOfDay, endOfDay)))
        .get();

    int totalRevenue = 0;
    int orderCount = 0;
    int completedCount = 0;

    for (final order in todayOrders) {
      if (order.status != 'refunded') {
        totalRevenue += order.finalAmount;
        orderCount++;
      }
      if (order.status == 'completed') {
        completedCount++;
      }
    }

    return {
      'totalRevenue': totalRevenue,
      'orderCount': orderCount,
      'completedCount': completedCount,
    };
  }

  Future<List<Map<String, dynamic>>> getTopDishes({int limit = 5}) async {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);

    final items = await (select(orderItems).join([
      innerJoin(orders, orders.id.equalsExp(orderItems.orderId)),
    ])
          ..where(orders.createdAt.isBetweenValues(startOfDay, endOfDay)))
        .get();

    final dishSales = <int, Map<String, dynamic>>{};
    for (final row in items) {
      final item = row.readTable(orderItems);
      final order = row.readTable(orders);
      if (order.status == 'refunded') continue;

      if (!dishSales.containsKey(item.dishId)) {
        dishSales[item.dishId] = {
          'dishId': item.dishId,
          'dishName': item.dishName,
          'soldCount': 0,
          'revenue': 0,
        };
      }
      dishSales[item.dishId]!['soldCount'] = (dishSales[item.dishId]!['soldCount'] as int) + item.quantity;
      dishSales[item.dishId]!['revenue'] = (dishSales[item.dishId]!['revenue'] as int) + item.subtotal;
    }

    final sorted = dishSales.values.toList()
      ..sort((a, b) => (b['soldCount'] as int).compareTo(a['soldCount'] as int));
    return sorted.take(limit).toList();
  }

  // ============ 数据归档 ============

  Future<void> performDailyArchive() async {
    final now = DateTime.now();
    final yesterday = now.subtract(const Duration(days: 1));
    final startOfYesterday = DateTime(yesterday.year, yesterday.month, yesterday.day);
    final endOfYesterday = DateTime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59);

    // 检查是否已归档
    if (await isArchiveLocked(startOfYesterday)) return;

    // 获取昨日订单
    final yesterdayOrders = await (select(orders)
          ..where((t) => t.createdAt.isBetweenValues(startOfYesterday, endOfYesterday)))
        .get();

    // 统计
    int orderCount = 0;
    int totalRevenue = 0;
    int refundCount = 0;
    int refundAmount = 0;
    int completedCount = 0;
    int pendingCount = 0;

    for (final order in yesterdayOrders) {
      orderCount++;
      if (order.status == 'refunded') {
        refundCount++;
        refundAmount += order.finalAmount;
      } else {
        totalRevenue += order.finalAmount;
      }
      if (order.status == 'completed') completedCount++;
      if (order.status == 'pending' || order.status == 'paid' || order.status == 'cooking') pendingCount++;
    }

    final netRevenue = totalRevenue - refundAmount;
    final avgOrderAmount = orderCount > 0 ? totalRevenue / orderCount / 100 : 0.0;

    // 插入每日统计
    await insertDailyStatistic(DailyStatisticsCompanion.insert(
      statDate: startOfYesterday,
      orderCount: Value(orderCount),
      totalRevenue: Value(totalRevenue),
      refundCount: Value(refundCount),
      refundAmount: Value(refundAmount),
      netRevenue: Value(netRevenue),
      avgOrderAmount: Value(avgOrderAmount),
      completedCount: Value(completedCount),
      pendingCount: Value(pendingCount),
    ));

    // 菜品日统计
    final dishStats = <int, Map<String, dynamic>>{};
    for (final order in yesterdayOrders) {
      final items = await getOrderItems(order.id);
      for (final item in items) {
        if (!dishStats.containsKey(item.dishId)) {
          dishStats[item.dishId] = {
            'dishId': item.dishId,
            'dishName': item.dishName,
            'soldCount': 0,
            'revenue': 0,
            'refundCount': 0,
            'refundAmount': 0,
          };
        }
        if (order.status == 'refunded') {
          dishStats[item.dishId]!['refundCount'] = (dishStats[item.dishId]!['refundCount'] as int) + item.quantity;
          dishStats[item.dishId]!['refundAmount'] = (dishStats[item.dishId]!['refundAmount'] as int) + item.subtotal;
        } else {
          dishStats[item.dishId]!['soldCount'] = (dishStats[item.dishId]!['soldCount'] as int) + item.quantity;
          dishStats[item.dishId]!['revenue'] = (dishStats[item.dishId]!['revenue'] as int) + item.subtotal;
        }
      }
    }

    for (final stat in dishStats.values) {
      await insertDishDailyStatistic(DishDailyStatisticsCompanion.insert(
        dishId: stat['dishId'] as int,
        dishName: stat['dishName'] as String,
        statDate: startOfYesterday,
        soldCount: Value(stat['soldCount'] as int),
        revenue: Value(stat['revenue'] as int),
        refundCount: Value(stat['refundCount'] as int),
        refundAmount: Value(stat['refundAmount'] as int),
      ));
    }

    // 更新菜品销量
    for (final order in yesterdayOrders) {
      if (order.status != 'refunded') {
        final items = await getOrderItems(order.id);
        for (final item in items) {
          final dish = await getDishById(item.dishId);
          if (dish != null) {
            await (update(dishes)..where((t) => t.id.equals(item.dishId))).write(
              DishesCompanion(
                soldCount: Value(dish.soldCount + item.quantity),
                updatedAt: Value(DateTime.now()),
              ),
            );
          }
        }
      }
    }

    // 加锁
    await lockArchive(startOfYesterday);
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'catering.db'));
    return NativeDatabase.createInBackground(file);
  });
}