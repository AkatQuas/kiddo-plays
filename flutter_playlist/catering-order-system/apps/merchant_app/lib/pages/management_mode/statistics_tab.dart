import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:database_core/database.dart';
import 'package:common_core/common_core.dart';

class StatisticsTab extends StatefulWidget {
  const StatisticsTab({super.key});

  @override
  State<StatisticsTab> createState() => _StatisticsTabState();
}

class _StatisticsTabState extends State<StatisticsTab> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<DailyStatistic> _dailyStats = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadStatistics();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadStatistics() async {
    final database = context.read<AppDatabase>();
    final now = DateTime.now();
    DateTime startDate;

    switch (_tabController.index) {
      case 0: // 今日
        startDate = DateTime(now.year, now.month, now.day);
        break;
      case 1: // 本周
        startDate = now.subtract(Duration(days: now.weekday - 1));
        startDate = DateTime(startDate.year, startDate.month, startDate.day);
        break;
      case 2: // 本月
        startDate = DateTime(now.year, now.month, 1);
        break;
      case 3: // 本年
        startDate = DateTime(now.year, 1, 1);
        break;
      default:
        startDate = DateTime(now.year, now.month, now.day);
    }

    final stats = await database.getDailyStatisticsList(startDate: startDate, endDate: now);
    if (mounted) {
      setState(() {
        _dailyStats = stats;
        _isLoading = false;
      });
    }
  }

  double _getTotalRevenue() {
    return _dailyStats.fold(0.0, (sum, stat) => sum + stat.netRevenue);
  }

  int _getTotalOrders() {
    return _dailyStats.fold(0, (sum, stat) => sum + stat.orderCount);
  }

  int _getTotalRefunds() {
    return _dailyStats.fold(0, (sum, stat) => sum + stat.refundCount);
  }

  double _getAvgOrderAmount() {
    if (_dailyStats.isEmpty) return 0;
    final total = _getTotalRevenue();
    final orders = _getTotalOrders();
    return orders > 0 ? total / orders / 100 : 0;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tabController,
          labelColor: Colors.orange,
          unselectedLabelColor: Colors.grey,
          onTap: (_) => _loadStatistics(),
          tabs: const [
            Tab(text: '今日'),
            Tab(text: '本周'),
            Tab(text: '本月'),
            Tab(text: '本年'),
          ],
        ),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _dailyStats.isEmpty
                  ? const Center(child: Text('暂无统计数据'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 统计概览
                          _buildStatCards(),
                          const SizedBox(height: 24),
                          // 趋势图表占位
                          Text(
                            '营收趋势',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (_dailyStats.isNotEmpty)
                            _buildTrendChart(),
                          const SizedBox(height: 24),
                          // 导出按钮
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _exportExcel,
                              icon: const Icon(Icons.download),
                              label: const Text('导出Excel'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.orange,
                                foregroundColor: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildStatCards() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildStatCard('营收', CurrencyUtils.formatWithSymbol(_getTotalRevenue().toInt()), Colors.green)),
            const SizedBox(width: 12),
            Expanded(child: _buildStatCard('订单', '${_getTotalOrders()}', Colors.blue)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _buildStatCard('客单价', '¥${_getAvgOrderAmount().toStringAsFixed(2)}', Colors.purple)),
            const SizedBox(width: 12),
            Expanded(child: _buildStatCard('退款', '${_getTotalRefunds()}', Colors.red)),
          ],
        ),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildTrendChart() {
    // 简化版本：显示列表
    return Card(
      child: Column(
        children: _dailyStats.take(10).map((stat) => ListTile(
          leading: const Icon(Icons.timeline),
          title: Text(DateTimeUtils.formatDate(stat.statDate)),
          trailing: Text(
            CurrencyUtils.formatWithSymbol(stat.netRevenue),
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
          ),
        )).toList(),
      ),
    );
  }

  Future<void> _exportExcel() async {
    ToastUtils.showSuccess(context, 'Excel导出功能开发中');
  }
}