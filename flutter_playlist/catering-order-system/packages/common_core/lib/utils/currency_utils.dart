class CurrencyUtils {
  static String format(int amountInCents) {
    final yuan = amountInCents / 100;
    return yuan.toStringAsFixed(2);
  }

  static String formatWithSymbol(int amountInCents) {
    return '¥${format(amountInCents)}';
  }

  static int yuanToCents(double yuan) {
    return (yuan * 100).round();
  }

  static int calculateTotal(List<int> prices, List<int> quantities) {
    int total = 0;
    for (int i = 0; i < prices.length; i++) {
      total += prices[i] * quantities[i];
    }
    return total;
  }

  static String formatDiscount(int amountInCents) {
    if (amountInCents == 0) return '0';
    return format(amountInCents);
  }
}