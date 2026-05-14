import 'package:flutter/material.dart';
import 'dashboard_tab.dart';
import 'ordering_tab.dart';
import 'order_list_tab.dart';

class OrderModePage extends StatefulWidget {
  const OrderModePage({super.key});

  @override
  State<OrderModePage> createState() => _OrderModePageState();
}

class _OrderModePageState extends State<OrderModePage> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    DashboardTab(),
    OrderingTab(),
    OrderListTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _tabs[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: '简报',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
            selectedIcon: Icon(Icons.add_circle),
            label: '点菜',
          ),
          NavigationDestination(
            icon: Icon(Icons.list_alt_outlined),
            selectedIcon: Icon(Icons.list_alt),
            label: '订单',
          ),
        ],
      ),
    );
  }
}