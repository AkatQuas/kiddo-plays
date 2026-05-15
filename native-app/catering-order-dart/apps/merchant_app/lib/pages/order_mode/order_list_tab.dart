import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:database_core/database.dart';
import 'package:common_core/common_core.dart';
import 'package:offline_voice/offline_voice.dart';

class OrderListTab extends StatefulWidget {
  const OrderListTab({super.key});

  @override
  State<OrderListTab> createState() => _OrderListTabState();
}

class _OrderListTabState extends State<OrderListTab> {
  List<Order> _orders = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    final database = context.read<AppDatabase>();
    final orders = await database.getTodayOrders();
    if (mounted) {
      setState(() {
        _orders = orders;
        _isLoading = false;
      });
    }
  }

  Future<void> _updateOrderStatus(Order order, String newStatus) async {
    final database = context.read<AppDatabase>();
    final tts = context.read<OfflineTts>();

    try {
      await database.updateOrderStatus(order.id, newStatus);

      // 语音播报
      if (newStatus == 'paid') {
        await tts.announcePaymentReceived();
      } else if (newStatus == 'completed') {
        await tts.announceOrderReady(order.orderNumber);
      }

      await _loadOrders();
      ToastUtils.showSuccess(context, '状态已更新');
    } catch (e) {
      ToastUtils.showError(context, '操作失败: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _orders.isEmpty
              ? const Center(child: Text('今日暂无订单'))
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: _orders.length,
                  itemBuilder: (context, index) {
                    final order = _orders[index];
                    return _OrderCard(
                      order: order,
                      onStatusUpdate: (status) => _updateOrderStatus(order, status),
                    );
                  },
                ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Order order;
  final Function(String) onStatusUpdate;

  const _OrderCard({required this.order, required this.onStatusUpdate});

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return Colors.orange;
      case 'paid': return Colors.blue;
      case 'cooking': return Colors.purple;
      case 'completed': return Colors.green;
      case 'refunded': return Colors.red;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor(order.status);

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        children: [
          // 订单头部
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            '订单 #${order.orderNumber}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          if (order.tableNumber != null) ...[
                            const SizedBox(width: 8),
                            Chip(
                              avatar: const Icon(Icons.table_restaurant, size: 14),
                              label: Text(order.tableNumber!, style: const TextStyle(fontSize: 12)),
                              padding: EdgeInsets.zero,
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ],
                        ],
                      ),
                      Text(
                        DateTimeUtils.formatDateTime(order.createdAt),
                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    OrderStatus.getDisplayName(order.status),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          // 订单内容
          FutureBuilder<List<OrderItem>>(
            future: context.read<AppDatabase>().getOrderItems(order.id),
            builder: (context, snapshot) {
              final items = snapshot.data ?? [];
              return Column(
                children: [
                  ...items.map((item) => ListTile(
                    dense: true,
                    title: Text(item.dishName),
                    trailing: Text('x${item.quantity}'),
                  )),
                  const Divider(),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('合计', style: TextStyle(fontWeight: FontWeight.bold)),
                        Text(
                          CurrencyUtils.formatWithSymbol(order.finalAmount),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.green),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
          // 操作按钮（仅正向流转）
          if (order.status != 'refunded')
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (order.status == 'pending')
                    ElevatedButton(
                      onPressed: () => onStatusUpdate('paid'),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                      child: const Text('确认收款'),
                    ),
                  if (order.status == 'paid')
                    ElevatedButton(
                      onPressed: () => onStatusUpdate('cooking'),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.purple),
                      child: const Text('出餐'),
                    ),
                  if (order.status == 'cooking')
                    ElevatedButton(
                      onPressed: () => onStatusUpdate('completed'),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                      child: const Text('完成'),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}