import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:drift/drift.dart' show Value;
import 'package:database_core/database.dart';
import 'package:common_core/common_core.dart';
import 'package:offline_voice/offline_voice.dart';

class CartItem {
  Dishe dish;
  int quantity;
  CartItem(this.dish, this.quantity);
}

class OrderingTab extends StatefulWidget {
  const OrderingTab({super.key});

  @override
  State<OrderingTab> createState() => _OrderingTabState();
}

class _OrderingTabState extends State<OrderingTab> {
  List<Dishe> _dishes = [];
  List<CartItem> _cart0 = [];
  List<CartItem> _cart1 = [];
  int _currentCart = 0;
  bool _isLoading = true;
  final OfflineAsr _asr = OfflineAsr();
  int _tableCount = 0;
  String _selectedTableNumber = '自由';
  List<String> _tableOptions = ['自由'];

  @override
  void initState() {
    super.initState();
    _loadDishees();
    _loadConfig();
    _asr.initialize();
  }

  Future<void> _loadDishees() async {
    final database = context.read<AppDatabase>();
    final dishes = await database.getAvailableDishes();
    if (mounted) {
      setState(() {
        _dishes = dishes;
        _isLoading = false;
      });
    }
  }

  Future<void> _loadConfig() async {
    final database = context.read<AppDatabase>();
    final count = int.tryParse(await database.getConfig('table_count') ?? '0') ?? 0;
    final options = <String>['自由'];
    for (int i = 1; i <= count; i++) {
      options.add(i.toString());
    }
    if (mounted) {
      setState(() {
        _tableCount = count;
        _tableOptions = options;
        if (count == 0) {
          _selectedTableNumber = '自由';
        }
      });
    }
  }

  List<CartItem> get _currentCartItems => _currentCart == 0 ? _cart0 : _cart1;

  void _addToCart(Dishe dish) {
    final cart = _currentCartItems;
    final existingIndex = cart.indexWhere((item) => item.dish.id == dish.id);

    if (existingIndex >= 0) {
      if (cart[existingIndex].quantity < dish.stock) {
        setState(() => cart[existingIndex].quantity++);
      } else {
        ToastUtils.showError(context, '库存不足');
      }
    } else {
      if (dish.stock > 0) {
        setState(() => cart.add(CartItem(dish, 1)));
      } else {
        ToastUtils.showError(context, '已售罄');
      }
    }
  }

  void _removeFromCart(Dishe dish) {
    final cart = _currentCartItems;
    final existingIndex = cart.indexWhere((item) => item.dish.id == dish.id);

    if (existingIndex >= 0) {
      if (cart[existingIndex].quantity > 1) {
        setState(() => cart[existingIndex].quantity--);
      } else {
        setState(() => cart.removeAt(existingIndex));
      }
    }
  }

  int _getCartItemCount(Dishe dish) {
    final cart = _currentCartItems;
    final item = cart.where((item) => item.dish.id == dish.id).firstOrNull;
    return item?.quantity ?? 0;
  }

  int _getCartTotal() {
    return _currentCartItems.fold(0, (sum, item) => sum + item.dish.price * item.quantity);
  }

  void _clearCart() {
    setState(() {
      if (_currentCart == 0) {
        _cart0.clear();
      } else {
        _cart1.clear();
      }
    });
  }

  Future<void> _submitOrder() async {
    if (_currentCartItems.isEmpty) {
      ToastUtils.showError(context, '请先选择菜品');
      return;
    }

    // 下单二次核对弹窗
    final confirm = await ConfirmDialog.show(
      context,
      title: '确认下单',
      content: _buildOrderConfirmContent(),
      confirmText: '确认下单',
    );

    if (!confirm) return;

    final database = context.read<AppDatabase>();
    final tts = context.read<OfflineTts>();

    try {
      // 生成订单编号
      final orderNumber = DateTime.now().millisecondsSinceEpoch.toString().substring(5);

      // 计算总金额
      final totalAmount = _getCartTotal();

      // 创建订单
      final orderId = await database.insertOrder(OrdersCompanion.insert(
        orderNumber: orderNumber,
        status: const Value('pending'),
        totalAmount: totalAmount,
        finalAmount: totalAmount,
        tableNumber: Value(_selectedTableNumber),
        cartIndex: Value(_currentCart),
      ));

      // 创建订单项并扣减库存
      final orderItems = <OrderItemsCompanion>[];
      for (final item in _currentCartItems) {
        orderItems.add(OrderItemsCompanion.insert(
          orderId: orderId,
          dishId: item.dish.id,
          dishName: item.dish.name,
          unitPrice: item.dish.price,
          quantity: item.quantity,
          subtotal: item.dish.price * item.quantity,
        ));

        await database.updateDishStock(item.dish.id, item.quantity);
      }

      await database.insertOrderItems(orderItems);

      // 语音播报
      await tts.announceNewOrder(orderNumber);

      // 清空购物车
      _clearCart();

      // 刷新菜品列表
      await _loadDishees();

      if (!mounted) return;
      ToastUtils.showSuccess(context, '下单成功');
    } catch (e) {
      if (!mounted) return;
      ToastUtils.showError(context, '下单失败: $e');
    }
  }

  String _buildOrderConfirmContent() {
    final buffer = StringBuffer();
    for (final item in _currentCartItems) {
      buffer.writeln('${item.dish.name} x${item.quantity}  ${CurrencyUtils.formatWithSymbol(item.dish.price * item.quantity)}');
    }
    buffer.writeln('');
    buffer.writeln('合计: ${CurrencyUtils.formatWithSymbol(_getCartTotal())}');
    return buffer.toString();
  }

  Future<void> _startVoiceOrder() async {
    ToastUtils.show(context, '请说出菜品名称...', isError: false);

    await _asr.startListening(
      onResult: (text) async {
        if (text.isEmpty) return;

        ToastUtils.show(context, '识别: $text');

        // 模糊匹配菜品
        final candidates = _dishes.map((d) => {'id': d.id, 'name': d.name, 'dish': d}).toList();
        final match = OfflineAsr.findBestMatch(text, candidates);

        if (match != null) {
          final dish = match['dish'] as Dishe;
          _addToCart(dish);
          ToastUtils.showSuccess(context, '已添加: ${dish.name}');
        } else {
          ToastUtils.showError(context, '未找到匹配菜品');
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 购物车切换
        Container(
          color: Colors.grey[100],
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _currentCart = 0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _currentCart == 0 ? Colors.orange : Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('购物车1', style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _currentCart == 0 ? Colors.white : Colors.black,
                        )),
                        if (_cart0.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.white,
                            child: Text('${_cart0.length}', style: const TextStyle(fontSize: 12, color: Colors.orange)),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _currentCart = 1),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _currentCart == 1 ? Colors.orange : Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('购物车2', style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _currentCart == 1 ? Colors.white : Colors.black,
                        )),
                        if (_cart1.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.white,
                            child: Text('${_cart1.length}', style: const TextStyle(fontSize: 12, color: Colors.orange)),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        // 菜品网格
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _dishes.isEmpty
                  ? const Center(child: Text('暂无菜品，请先添加菜品'))
                  : GridView.builder(
                      padding: const EdgeInsets.all(8),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        childAspectRatio: 0.8,
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                      ),
                      itemCount: _dishes.length,
                      itemBuilder: (context, index) {
                        final dish = _dishes[index];
                        final count = _getCartItemCount(dish);

                        return GestureDetector(
                          onTap: () => _addToCart(dish),
                          onLongPress: count > 0 ? () => _removeFromCart(dish) : null,
                          child: Card(
                            color: dish.status == 'sold_out' ? Colors.grey[200] : null,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.fastfood,
                                  size: 40,
                                  color: dish.status == 'sold_out' ? Colors.grey : Colors.orange,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  dish.name,
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: dish.status == 'sold_out' ? Colors.grey : null,
                                  ),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  CurrencyUtils.formatWithSymbol(dish.price),
                                  style: TextStyle(
                                    color: dish.status == 'sold_out' ? Colors.grey : Colors.green,
                                  ),
                                ),
                                if (count > 0) ...[
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.orange,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text('x$count', style: const TextStyle(color: Colors.white, fontSize: 12)),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      },
                    ),
        ),
        // 底部操作栏
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(color: Colors.grey.withValues(alpha: 0.3), blurRadius: 4, offset: const Offset(0, -2)),
            ],
          ),
          child: Row(
            children: [
              // 语音点单
              IconButton(
                onPressed: _startVoiceOrder,
                icon: const Icon(Icons.mic, color: Colors.orange),
                tooltip: '语音点单',
              ),
              // 清空购物车
              IconButton(
                onPressed: _currentCartItems.isEmpty ? null : _clearCart,
                icon: const Icon(Icons.delete_outline),
                tooltip: '清空',
              ),
              const SizedBox(width: 8),
              // 桌号选择
              if (_tableCount > 0)
                DropdownButton<String>(
                  value: _selectedTableNumber,
                  items: _tableOptions.map((table) {
                    return DropdownMenuItem(
                      value: table,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.table_restaurant, size: 18, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text('桌号: $table'),
                        ],
                      ),
                    );
                  }).toList(),
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _selectedTableNumber = value);
                    }
                  },
                )
              else
                const Chip(
                  avatar: Icon(Icons.table_restaurant, size: 16),
                  label: Text('自由'),
                ),
              const Spacer(),
              // 购物车摘要
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '合计: ${CurrencyUtils.formatWithSymbol(_getCartTotal())}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Text('${_currentCartItems.length}个菜品', style: const TextStyle(color: Colors.grey)),
                ],
              ),
              const SizedBox(width: 16),
              // 下单按钮
              ElevatedButton(
                onPressed: _currentCartItems.isEmpty ? null : _submitOrder,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: const Text('下单'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}