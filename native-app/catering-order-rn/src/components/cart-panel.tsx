import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useOrderStore, type CartItem } from '@/src/stores/order-store';
import { Button } from './ui/button';

interface CartPanelProps {
  onCheckout: () => void;
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const {
    cart1, cart2, activeCartIndex, setActiveCart,
    updateQuantity, removeFromCart, clearCart,
  } = useOrderStore();

  const activeCart = activeCartIndex === 1 ? cart1 : cart2;
  const cartCount1 = cart1.reduce((s, i) => s + i.quantity, 0);
  const cartCount2 = cart2.reduce((s, i) => s + i.quantity, 0);
  const total = activeCart.reduce((s, i) => s + i.dish.price * i.quantity, 0);
  const isEmpty = activeCart.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeCartIndex === 1 && styles.activeTab]}
          onPress={() => setActiveCart(1)}
        >
          <Text style={[styles.tabText, activeCartIndex === 1 && styles.activeTabText]}>
            购物车1 ({cartCount1})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeCartIndex === 2 && styles.activeTab]}
          onPress={() => setActiveCart(2)}
        >
          <Text style={[styles.tabText, activeCartIndex === 2 && styles.activeTabText]}>
            购物车2 ({cartCount2})
          </Text>
        </TouchableOpacity>
      </View>

      {isEmpty ? (
        <Text style={styles.empty}>购物车为空</Text>
      ) : (
        <FlatList
          data={activeCart}
          keyExtractor={(item) => item.dish.id.toString()}
          style={styles.list}
          renderItem={({ item }) => (
            <CartItemRow item={item} onUpdate={updateQuantity} onRemove={removeFromCart} />
          )}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => clearCart()}>
          <Text style={styles.clearText}>清空</Text>
        </TouchableOpacity>
        <Text style={styles.total}>¥{total.toFixed(2)}</Text>
        <Button
          title="结算"
          onPress={onCheckout}
          disabled={isEmpty}
          style={{ flex: 1, marginLeft: 12 }}
        />
      </View>
    </View>
  );
}

function CartItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  onUpdate: (dishId: number, delta: number) => void;
  onRemove: (dishId: number) => void;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.dish.dish_name}</Text>
        <Text style={styles.itemPrice}>¥{item.dish.price.toFixed(2)}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.miniBtn}
          onPress={() => {
            if (item.quantity <= 1) onRemove(item.dish.id);
            else onUpdate(item.dish.id, -1);
          }}
        >
          <Text style={styles.miniBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.itemQty}>{item.quantity}</Text>
        <TouchableOpacity
          style={[styles.miniBtn, { backgroundColor: '#2563EB' }]}
          onPress={() => onUpdate(item.dish.id, 1)}
        >
          <Text style={[styles.miniBtnText, { color: '#fff' }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 300,
  },
  tabs: { flexDirection: 'row' },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 14, color: '#6B7280' },
  activeTabText: { color: '#2563EB', fontWeight: '600' },
  empty: { textAlign: 'center', padding: 16, color: '#9CA3AF', fontSize: 14 },
  list: { maxHeight: 160 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: '#F3F4F6',
  },
  itemName: { fontSize: 14, color: '#374151' },
  itemPrice: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBtnText: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  itemQty: { fontSize: 14, fontWeight: '600', minWidth: 18, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  clearText: { color: '#EF4444', fontSize: 14, marginRight: 12 },
  total: { fontSize: 18, fontWeight: '700', color: '#EF4444' },
});