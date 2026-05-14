class AppConstants {
  static const String appName = '餐饮订单管理';
  static const String appVersion = '1.0.0';
  static const int databaseVersion = 1;

  // 订单相关
  static const int orderTimeoutMinutes = 30;
  static const int maxOrderItems = 50;

  // 库存相关
  static const int defaultStock = 100;
  static const int lowStockThreshold = 10;

  // 归档相关
  static const String archiveTime = '00:00';

  // 超时相关
  static const int managementModeTimeoutMinutes = 5;
}

class OrderStatus {
  static const String pending = 'pending';           // 已下单未支付
  static const String paid = 'paid';                 // 已支付未出餐
  static const String cooking = 'cooking';           // 已出餐未支付
  static const String completed = 'completed';       // 已完成
  static const String refunded = 'refunded';         // 已退款

  static const List<String> positiveFlow = [pending, paid, cooking, completed];
  static const List<String> refundableStatus = [paid, cooking, completed];

  static String getDisplayName(String status) {
    switch (status) {
      case pending: return '待支付';
      case paid: return '待出餐';
      case cooking: return '待取餐';
      case completed: return '已完成';
      case refunded: return '已退款';
      default: return '未知';
    }
  }
}

class DishStatus {
  static const String available = 'available';       // 在售
  static const String soldOut = 'sold_out';          // 售罄
  static const String disabled = 'disabled';         // 下架

  static String getDisplayName(String status) {
    switch (status) {
      case available: return '在售';
      case soldOut: return '售罄';
      case disabled: return '下架';
      default: return '未知';
    }
  }
}

class AppMode {
  static const String order = 'order';               // 接单模式
  static const String management = 'management';     // 管理模式

  static String getDisplayName(String mode) {
    switch (mode) {
      case order: return '接单';
      case management: return '管理';
      default: return '未知';
    }
  }
}