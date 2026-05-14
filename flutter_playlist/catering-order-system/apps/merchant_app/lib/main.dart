import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:database_core/database.dart';
import 'package:auth_core/auth_core.dart';
import 'package:offline_voice/offline_voice.dart';

import 'pages/splash_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 初始化数据库
  final database = AppDatabase();
  await database.performDailyArchive();  // 补偿触发归档

  // 初始化语音
  final tts = OfflineTts();
  await tts.initialize();

  // 初始化认证服务
  final authService = AuthService();

  runApp(
    MultiProvider(
      providers: [
        Provider<AppDatabase>.value(value: database),
        Provider<OfflineTts>.value(value: tts),
        ChangeNotifierProvider<AuthService>.value(value: authService),
      ],
      child: const CateringApp(),
    ),
  );
}

class CateringApp extends StatelessWidget {
  const CateringApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '餐饮订单管理',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.orange),
        useMaterial3: true,
      ),
      home: const SplashPage(),
    );
  }
}