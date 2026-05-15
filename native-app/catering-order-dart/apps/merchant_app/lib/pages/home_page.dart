import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:auth_core/auth_core.dart';
import 'package:common_core/common_core.dart';
import 'package:database_core/database.dart';
import 'order_mode/order_mode_page.dart';
import 'management_mode/management_mode_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _checkArchive();
  }

  Future<void> _checkArchive() async {
    final database = context.read<AppDatabase>();
    final authService = context.read<AuthService>();
    final biometricEnabled = await database.getConfig('biometric_enabled') == 'true';
    authService.initialize(biometricEnabled: biometricEnabled);
  }

  Future<void> _switchMode() async {
    final authService = context.read<AuthService>();

    if (authService.isManagementMode) {
      authService.switchToOrderMode();
      return;
    }

    // 接单模式切换到管理模式需要验证密码
    final database = context.read<AppDatabase>();
    final storedPassword = await database.getConfig('admin_password');

    final password = await InputDialog.show(
      context,
      title: '切换到管理模式',
      hint: '请输入管理员密码',
      obscureText: true,
    );

    if (password == null || password.isEmpty) return;

    if (storedPassword != null && password == storedPassword) {
      authService.switchToManagementMode(password, storedPassword);
    } else {
      if (!mounted) return;
      ToastUtils.showError(context, '密码错误');
    }
  }

  void _showModeSwitchDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('切换模式'),
        content: Text(
          context.read<AuthService>().isOrderMode
              ? '确定要切换到管理模式吗？'
              : '确定要切换回接单模式吗？',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _switchMode();
            },
            child: const Text('确认'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    final isOrderMode = authService.isOrderMode;

    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        title: Text(isOrderMode ? '接单模式' : '管理模式'),
        backgroundColor: isOrderMode ? Colors.green : Colors.orange,
        foregroundColor: Colors.white,
        actions: [
          TextButton.icon(
            onPressed: _showModeSwitchDialog,
            icon: const Icon(Icons.swap_horiz, color: Colors.white),
            label: Text(
              isOrderMode ? '切换管理' : '切换接单',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      drawer: _buildDrawer(),
      body: isOrderMode ? const OrderModePage() : const ManagementModePage(),
    );
  }

  Widget _buildDrawer() {
    final authService = context.watch<AuthService>();
    final isOrderMode = authService.isOrderMode;

    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              color: isOrderMode ? Colors.green : Colors.orange,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const Icon(Icons.restaurant_menu, size: 48, color: Colors.white),
                const SizedBox(height: 8),
                FutureBuilder<String?>(
                  future: context.read<AppDatabase>().getConfig('shop_name'),
                  builder: (context, snapshot) {
                    return Text(
                      snapshot.data ?? '餐饮小店',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    );
                  },
                ),
                Text(
                  isOrderMode ? '接单模式' : '管理模式',
                  style: const TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('免责声明'),
            onTap: () => _showDisclaimer(),
          ),
          ListTile(
            leading: const Icon(Icons.help_outline),
            title: const Text('新手教程'),
            onTap: () {},
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.settings),
            title: const Text('关于'),
            onTap: () => _showAbout(),
          ),
        ],
      ),
    );
  }

  void _showDisclaimer() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber, color: Colors.orange),
            SizedBox(width: 8),
            Text('免责声明'),
          ],
        ),
        content: const SingleChildScrollView(
          child: Text(
            '1. 本系统为个人开发者制作的非商用软件\n\n'
            '2. 不在任何应用市场上架，仅线下人工分发\n\n'
            '3. 不采集、不上传、不备份任何门店经营数据\n\n'
            '4. 所有数据仅存储在当前设备本地\n\n'
            '5. 因设备损坏、误删等造成的数据丢失，使用者自行承担\n\n'
            '6. 资金安全由使用者自行负责，本系统仅记录账单',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('我已知悉'),
          ),
        ],
      ),
    );
  }

  void _showAbout() {
    showAboutDialog(
      context: context,
      applicationName: '餐饮订单管理',
      applicationVersion: '1.0.0',
      applicationIcon: const Icon(Icons.restaurant_menu, size: 48, color: Colors.orange),
      children: const [
        Text('个人开发者作品'),
        Text('非商用、不上架'),
        Text('数据本地存储'),
      ],
    );
  }
}