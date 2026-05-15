import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { Order, OrderItem } from '@/src/db/repositories/order-repository';

interface OrderCardProps {
  order: Order;
  items: OrderItem[];
  onConfirmPayment?: (orderId: number) => void;
  onRefund?: (order: Order) => void;
}

function getBadgeVariant(status: string): 'paid' | 'unpaid' | 'refunded' | 'default' {
  switch (status) {
    case '已支付': return 'paid';
    case '未支付': return 'unpaid';
    case '已退款': return 'refunded';
    default: return 'default';
  }
}

export function OrderCard({ order, items, onConfirmPayment, onRefund }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const canPay = order.order_status === '未支付';
  const canRefund = order.order_status === '已支付';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderNo}>#{order.order_no.slice(-8)}</Text>
          <Text style={styles.table}>桌号: {order.table}</Text>
        </View>
        <Badge text={order.order_status} variant={getBadgeVariant(order.order_status)} />
      </View>

      <View style={styles.summary}>
        <Text style={styles.time}>
          {order.create_time ? order.create_time.slice(11, 19) : ''}
        </Text>
        <Text style={styles.amount}>¥{order.total_money.toFixed(2)}</Text>
      </View>

      {expanded && (
        <View style={styles.detail}>
          {items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.dish_name ?? `菜品#${item.dish_id}`}</Text>
              <Text style={styles.itemQty}>x{item.buy_num}</Text>
              <Text style={styles.itemPrice}>¥{(item.single_price * item.buy_num).toFixed(2)}</Text>
            </View>
          ))}

          {order.order_status === '已退款' && order.refund_remark && (
            <View style={styles.refundInfo}>
              <Text style={styles.refundLabel}>退款备注: {order.refund_remark}</Text>
              {order.refund_method && <Text style={styles.refundLabel}>退款方式: {order.refund_method}</Text>}
            </View>
          )}

          <View style={styles.actions}>
            {canPay && onConfirmPayment && (
              <Button title="确认收款" onPress={() => onConfirmPayment(order.id)} variant="primary" style={{ flex: 1 }} />
            )}
            {canRefund && onRefund && (
              <Button title="退款" onPress={() => onRefund(order)} variant="danger" style={{ flex: 1 }} />
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  orderNo: { fontSize: 15, fontWeight: '600', color: '#111827' },
  table: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  time: { fontSize: 12, color: '#9CA3AF' },
  amount: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  detail: { borderTopWidth: 1, borderColor: '#F3F4F6', marginTop: 8, paddingTop: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: { flex: 1, fontSize: 13, color: '#374151' },
  itemQty: { fontSize: 13, color: '#6B7280', marginRight: 12 },
  itemPrice: { fontSize: 13, color: '#EF4444', fontWeight: '500' },
  refundInfo: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  refundLabel: { fontSize: 12, color: '#991B1B' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});