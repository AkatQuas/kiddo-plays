import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:drift/drift.dart' show Value;
import 'package:database_core/database.dart';
import 'package:common_core/common_core.dart';
import 'package:auth_core/auth_core.dart';

class MaterialManagementTab extends StatefulWidget {
  const MaterialManagementTab({super.key});

  @override
  State<MaterialManagementTab> createState() => _MaterialManagementTabState();
}

class _MaterialManagementTabState extends State<MaterialManagementTab> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Dishe> _dishes = [];
  List<Order> _orders = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final database = context.read<AppDatabase>();
    final dishes = await database.getAllDishes();
    final orders = await database.getAllOrders(limit: 100);

    if (mounted) {
      setState(() {
        _dishes = dishes;
        _orders = orders;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tabController,
          labelColor: Colors.orange,
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(text: '菜品管理'),
            Tab(text: '订单管理'),
          ],
        ),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildDisheManagement(),
                    _buildOrderManagement(),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildDisheManagement() {
    return Scaffold(
      body: _dishes.isEmpty
          ? const Center(child: Text('暂无菜品'))
          : ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: _dishes.length,
              itemBuilder: (context, index) {
                final dish = _dishes[index];
                return _buildDisheCard(dish);
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDishDialog,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildDisheCard(Dishe dish) {
    final isSoldOut = dish.status == 'sold_out';
    final isDisabled = dish.status == 'disabled';

    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isDisabled ? Colors.grey : Colors.orange,
          child: const Icon(Icons.fastfood, color: Colors.white),
        ),
        title: Text(
          dish.name,
          style: TextStyle(
            decoration: isDisabled ? TextDecoration.lineThrough : null,
            color: isDisabled ? Colors.grey : null,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(CurrencyUtils.formatWithSymbol(dish.price)),
            Row(
              children: [
                Text('库存: ${dish.stock}', style: TextStyle(color: dish.stock <= 10 ? Colors.red : Colors.grey)),
                const SizedBox(width: 8),
                Text('销量: ${dish.soldCount}', style: const TextStyle(color: Colors.grey)),
              ],
            ),
          ],
        ),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            if (!isDisabled) ...[
              const PopupMenuItem(value: 'edit', child: Text('编辑')),
              if (isSoldOut)
                const PopupMenuItem(value: 'restore', child: Text('恢复售卖')),
              const PopupMenuItem(value: 'sold_out', child: Text('手动售罄')),
              const PopupMenuItem(value: 'disable', child: Text('下架')),
            ] else
              const PopupMenuItem(value: 'enable', child: Text('上架')),
          ],
          onSelected: (value) => _handleDisheAction(dish, value),
        ),
        isThreeLine: true,
      ),
    );
  }

  Widget _buildOrderManagement() {
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: _orders.length,
      itemBuilder: (context, index) {
        final order = _orders[index];
        return Card(
          child: ListTile(
            leading: order.tableNumber != null
                ? Icon(Icons.table_restaurant, color: Colors.grey[600])
                : null,
            title: Row(
              children: [
                Text('订单 #${order.orderNumber}'),
                if (order.tableNumber != null) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      order.tableNumber!,
                      style: const TextStyle(fontSize: 12, color: Colors.orange),
                    ),
                  ),
                ],
              ],
            ),
            subtitle: Text(DateTimeUtils.formatDateTime(order.createdAt)),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  CurrencyUtils.formatWithSymbol(order.finalAmount),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: _getStatusColor(order.status),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    OrderStatus.getDisplayName(order.status),
                    style: const TextStyle(color: Colors.white, fontSize: 10),
                  ),
                ),
              ],
            ),
            onTap: () => _showOrderDetail(order),
          ),
        );
      },
    );
  }

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

  Future<void> _handleDisheAction(Dishe dish, String action) async {
    final database = context.read<AppDatabase>();

    switch (action) {
      case 'edit':
        _showEditDishDialog(dish);
        break;
      case 'restore':
        await database.restoreDishFromSoldOut(dish.id);
        break;
      case 'sold_out':
        await database.markDishSoldOut(dish.id);
        break;
      case 'disable':
        await database.updateDishStatus(dish.id, 'disabled');
        break;
      case 'enable':
        await database.updateDishStatus(dish.id, 'available');
        break;
    }
    _loadData();
  }

  Future<void> _showAddDishDialog() async {
    final nameController = TextEditingController();
    final priceController = TextEditingController();
    final stockController = TextEditingController(text: '100');

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('添加菜品'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: '菜品名称')),
            const SizedBox(height: 8),
            TextField(controller: priceController, decoration: const InputDecoration(labelText: '价格(元)'), keyboardType: TextInputType.number),
            const SizedBox(height: 8),
            TextField(controller: stockController, decoration: const InputDecoration(labelText: '初始库存'), keyboardType: TextInputType.number),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('添加')),
        ],
      ),
    );

    if (result == true) {
      final database = context.read<AppDatabase>();
      final price = ((double.tryParse(priceController.text) ?? 0) * 100).toInt();
      final stock = int.tryParse(stockController.text) ?? 100;

      await database.insertDish(DishesCompanion.insert(
        name: nameController.text,
        price: price,
        stock: Value(stock),
      ));

      ToastUtils.showSuccess(context, '菜品添加成功');
      _loadData();
    }
  }

  Future<void> _showEditDishDialog(Dishe dish) async {
    final nameController = TextEditingController(text: dish.name);
    final priceController = TextEditingController(text: (dish.price / 100).toString());
    final stockController = TextEditingController(text: dish.stock.toString());

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('编辑菜品'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: '菜品名称')),
            const SizedBox(height: 8),
            TextField(controller: priceController, decoration: const InputDecoration(labelText: '价格(元)'), keyboardType: TextInputType.number),
            const SizedBox(height: 8),
            TextField(controller: stockController, decoration: const InputDecoration(labelText: '库存'), keyboardType: TextInputType.number),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('保存')),
        ],
      ),
    );

    if (result == true) {
      final database = context.read<AppDatabase>();
      final price = ((double.tryParse(priceController.text) ?? 0) * 100).toInt();
      final stock = int.tryParse(stockController.text) ?? 100;

      await database.updateDishDetails(dish.id, nameController.text, price, stock);

      ToastUtils.showSuccess(context, '菜品更新成功');
      _loadData();
    }
  }

  Future<void> _showOrderDetail(Order order) async {
    final database = context.read<AppDatabase>();
    final items = await database.getOrderItems(order.id);
    final isManagementMode = context.read<AuthService>().isManagementMode;

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('订单 #${order.orderNumber}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('状态: ${OrderStatus.getDisplayName(order.status)}'),
            Text('创建时间: ${DateTimeUtils.formatDateTime(order.createdAt)}'),
            const Divider(),
            ...items.map((item) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(item.dishName),
              trailing: Text('x${item.quantity} ${CurrencyUtils.formatWithSymbol(item.subtotal)}'),
            )),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('合计', style: TextStyle(fontWeight: FontWeight.bold)),
                Text(CurrencyUtils.formatWithSymbol(order.finalAmount), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              ],
            ),
            if (isManagementMode && order.status != 'refunded') ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(context);
                    await _handleRefund(order);
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  child: const Text('退款'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _handleRefund(Order order) async {
    final database = context.read<AppDatabase>();

    final confirm = await ConfirmDialog.show(
      context,
      title: '确认退款',
      content: '订单 #${order.orderNumber}\n退款金额: ${CurrencyUtils.formatWithSymbol(order.finalAmount)}',
      confirmText: '确认退款',
      isDanger: true,
    );

    if (confirm) {
      // 恢复库存
      final items = await database.getOrderItems(order.id);
      for (final item in items) {
        await database.restoreDishStock(item.dishId, item.quantity);
      }

      // 更新订单状态
      await database.updateOrderStatus(order.id, 'refunded');

      ToastUtils.showSuccess(context, '退款成功');
      _loadData();
    }
  }
}