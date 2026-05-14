import 'package:flutter/material.dart';
import 'statistics_tab.dart';
import 'material_management_tab.dart';
import 'settings_tab.dart';

class ManagementModePage extends StatefulWidget {
  const ManagementModePage({super.key});

  @override
  State<ManagementModePage> createState() => _ManagementModePageState();
}

class _ManagementModePageState extends State<ManagementModePage> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    StatisticsTab(),
    MaterialManagementTab(),
    SettingsTab(),
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
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: '统计',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: '物料',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: '设置',
          ),
        ],
      ),
    );
  }
}