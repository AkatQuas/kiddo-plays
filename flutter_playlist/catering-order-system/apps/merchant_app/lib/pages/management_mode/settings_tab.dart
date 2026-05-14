import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:database_core/database.dart';
import 'package:common_core/common_core.dart';
import 'package:auth_core/auth_core.dart';

class SettingsTab extends StatefulWidget {
  const SettingsTab({super.key});

  @override
  State<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<SettingsTab> {
  String _shopName = '';
  bool _biometricEnabled = false;
  int _tableCount = 0;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final database = context.read<AppDatabase>();
    final shopName = await database.getConfig('shop_name') ?? '餐饮小店';
    final biometric = await database.getConfig('biometric_enabled') == 'true';
    final tableCount = int.tryParse(await database.getConfig('table_count') ?? '0') ?? 0;

    if (mounted) {
      setState(() {
        _shopName = shopName;
        _biometricEnabled = biometric;
        _tableCount = tableCount;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // 店铺信息
        _buildSection(
          '店铺信息',
          [
            ListTile(
              leading: const Icon(Icons.store),
              title: const Text('店铺名称'),
              subtitle: Text(_shopName),
              trailing: const Icon(Icons.chevron_right),
              onTap: _editShopName,
            ),
            ListTile(
              leading: const Icon(Icons.table_restaurant),
              title: const Text('桌子数量'),
              subtitle: Text(_tableCount > 0 ? '$_tableCount 桌' : '未设置 (自由桌模式)'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _editTableCount,
            ),
          ],
        ),
        const SizedBox(height: 16),
        // 收款设置
        _buildSection(
          '收款设置',
          [
            ListTile(
              leading: const Icon(Icons.qr_code),
              title: const Text('收款码'),
              subtitle: const Text('展示二维码给顾客扫码付款'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _editPaymentCode,
            ),
          ],
        ),
        const SizedBox(height: 16),
        // 安全设置
        _buildSection(
          '安全设置',
          [
            ListTile(
              leading: const Icon(Icons.lock),
              title: const Text('修改密码'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _changePassword,
            ),
            SwitchListTile(
              secondary: const Icon(Icons.fingerprint),
              title: const Text('生物识别'),
              subtitle: const Text('使用指纹或面容快速解锁管理模式'),
              value: _biometricEnabled,
              onChanged: _toggleBiometric,
            ),
          ],
        ),
        const SizedBox(height: 16),
        // 数据管理
        _buildSection(
          '数据管理',
          [
            ListTile(
              leading: const Icon(Icons.backup),
              title: const Text('数据备份'),
              subtitle: const Text('导出数据到本地'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _backupData,
            ),
            ListTile(
              leading: const Icon(Icons.restore),
              title: const Text('数据恢复'),
              subtitle: const Text('从备份文件恢复数据'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _restoreData,
            ),
          ],
        ),
        const SizedBox(height: 16),
        // 其他
        _buildSection(
          '其他',
          [
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('关于'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _showAbout,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 16, bottom: 8),
          child: Text(title, style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
        ),
        Card(
          child: Column(children: children),
        ),
      ],
    );
  }

  Future<void> _editShopName() async {
    final controller = TextEditingController(text: _shopName);
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('修改店铺名称'),
        content: TextField(controller: controller, decoration: const InputDecoration(labelText: '店铺名称')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('取消')),
          TextButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('保存')),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      final database = context.read<AppDatabase>();
      await database.setConfig('shop_name', result);
      ToastUtils.showSuccess(context, '店铺名称已更新');
      _loadConfig();
    }
  }

  Future<void> _editTableCount() async {
    final controller = TextEditingController(text: _tableCount > 0 ? _tableCount.toString() : '');
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('设置桌子数量'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: '桌子数量',
            hintText: '填写0或不填表示自由桌模式',
          ),
          keyboardType: TextInputType.number,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('取消')),
          TextButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('保存')),
        ],
      ),
    );

    final count = int.tryParse(result ?? '0') ?? 0;
    final database = context.read<AppDatabase>();
    await database.setConfig('table_count', count.toString());
    ToastUtils.showSuccess(context, '桌子数量已更新');
    _loadConfig();
  }

  Future<void> _editPaymentCode() async {
    ToastUtils.show(context, '收款码设置功能开发中');
  }

  Future<void> _changePassword() async {
    final currentPassword = await InputDialog.show(context, title: '修改密码', hint: '请输入当前密码', obscureText: true);
    if (currentPassword == null || currentPassword.isEmpty) return;

    final database = context.read<AppDatabase>();
    final storedPassword = await database.getConfig('admin_password');

    if (currentPassword != storedPassword) {
      ToastUtils.showError(context, '密码错误');
      return;
    }

    final newPassword = await InputDialog.show(context, title: '修改密码', hint: '请输入新密码', obscureText: true);
    if (newPassword == null || newPassword.length < 4) {
      ToastUtils.showError(context, '密码至少4位');
      return;
    }

    final confirmPassword = await InputDialog.show(context, title: '修改密码', hint: '请再次输入新密码', obscureText: true);
    if (newPassword != confirmPassword) {
      ToastUtils.showError(context, '两次密码不一致');
      return;
    }

    await database.setConfig('admin_password', newPassword);
    ToastUtils.showSuccess(context, '密码已修改');
  }

  Future<void> _toggleBiometric(bool value) async {
    final database = context.read<AppDatabase>();
    await database.setConfig('biometric_enabled', value.toString());

    final authService = context.read<AuthService>();
    authService.setBiometricEnabled(value);

    setState(() => _biometricEnabled = value);
    ToastUtils.showSuccess(context, value ? '生物识别已开启' : '生物识别已关闭');
  }

  Future<void> _backupData() async {
    ToastUtils.show(context, '数据备份功能开发中');
  }

  Future<void> _restoreData() async {
    ToastUtils.show(context, '数据恢复功能开发中');
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