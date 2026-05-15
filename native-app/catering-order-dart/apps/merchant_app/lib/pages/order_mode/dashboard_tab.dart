import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:database_core/database.dart';
import 'package:common_core/common_core.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  Map<String, int> _summary = {'totalRevenue': 0, 'orderCount': 0, 'completedCount': 0};
  List<Map<String, dynamic>> _topDishes = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final database = context.read<AppDatabase>();
    final summary = await database.getTodaySummary();
    final topDishes = await database.getTopDishes(limit: 5);

    if (mounted) {
      setState(() {
        _summary = summary;
        _topDishes = topDishes;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 简易营收卡片
            Card(
              color: Colors.green,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '今日营收',
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      CurrencyUtils.formatWithSymbol(_summary['totalRevenue'] ?? 0),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _buildStatItem('订单数', '${_summary['orderCount'] ?? 0}'),
                        const SizedBox(width: 24),
                        _buildStatItem('完成', '${_summary['completedCount'] ?? 0}'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            // 热销菜品
            Text(
              '今日热销',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            if (_topDishes.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                    child: Text('暂无销售数据', style: TextStyle(color: Colors.grey)),
                  ),
                ),
              )
            else
              ...List.generate(_topDishes.length, (index) {
                final dish = _topDishes[index];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.orange,
                      child: Text('${index + 1}', style: const TextStyle(color: Colors.white)),
                    ),
                    title: Text(dish['dishName'] ?? ''),
                    trailing: Text(
                      'x${dish['soldCount']}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
      ],
    );
  }
}