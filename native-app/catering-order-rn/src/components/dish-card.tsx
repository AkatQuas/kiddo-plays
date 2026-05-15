import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Dish } from '@/src/db/repositories/dish-repository';

interface DishCardProps {
  dish: Dish;
  quantity: number;
  onAdd: () => void;
  onSubtract: () => void;
}

export function DishCard({ dish, quantity, onAdd, onSubtract }: DishCardProps) {
  const isSoldOut = dish.is_sold_out_today === 1;

  return (
    <View style={[styles.card, isSoldOut && styles.soldOut]}>
      <View style={styles.info}>
        <Text style={[styles.name, isSoldOut && styles.soldOutText]}>
          {dish.dish_name}
        </Text>
        <Text style={[styles.price, isSoldOut && styles.soldOutText]}>
          ¥{dish.price.toFixed(2)}
        </Text>
        <Text style={styles.stock}>
          库存: {dish.stock_num_daily}
        </Text>
      </View>
      {isSoldOut ? (
        <View style={styles.soldOutBadge}>
          <Text style={styles.soldOutBadgeText}>售罄</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          {quantity > 0 && (
            <TouchableOpacity style={styles.qtyBtn} onPress={onSubtract}>
              <Text style={styles.qtyBtnText}>-</Text>
            </TouchableOpacity>
          )}
          {quantity > 0 && (
            <Text style={styles.qty}>{quantity}</Text>
          )}
          <TouchableOpacity
            style={[styles.addBtn, dish.stock_num_daily <= 0 && styles.disabledBtn]}
            onPress={onAdd}
            disabled={dish.stock_num_daily <= 0}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  soldOut: { opacity: 0.6 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: '#111827', marginBottom: 2 },
  soldOutText: { color: '#9CA3AF' },
  price: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
  stock: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 18, color: '#EF4444', fontWeight: '700' },
  qty: { fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: { backgroundColor: '#D1D5DB' },
  addBtnText: { fontSize: 18, color: '#fff', fontWeight: '700' },
  soldOutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  soldOutBadgeText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});