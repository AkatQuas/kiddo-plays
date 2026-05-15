import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useDishStore } from '@/src/stores/dish-store';
import { useOrderStore } from '@/src/stores/order-store';
import { DishCard } from '@/src/components/dish-card';
import { CartPanel } from '@/src/components/cart-panel';
import { FilterBar } from '@/src/components/filter-bar';
import { Loading } from '@/src/components/ui/loading';
import { Button } from '@/src/components/ui/button';
import { Modal } from '@/src/components/ui/modal';
import { Input } from '@/src/components/ui/input';
import { submitOrderWithLogging } from '@/src/services/order-service';
import { useOrderListStore } from '@/src/stores/order-list-store';
import { getTodayDateString } from '@/src/utils/time';

export default function OrderTakingScreen() {
  const { dishes, fetchDishes, isLoading } = useDishStore();
  const {
    cart1, cart2, activeCartIndex, currentTable, setTable,
    addToCart, updateQuantity, clearAllCarts,
  } = useOrderStore();
  const { fetchTodayOrders, fetchStats } = useOrderListStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableInput, setTableInput] = useState(currentTable);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('全部');

  useEffect(() => {
    fetchDishes();
  }, []);

  const categories = ['全部', ...new Set(dishes.map(d => d.dish_name[0] !== '?' ? '热销' : '其他'))];

  const filteredDishes = activeCategory === '全部'
    ? dishes
    : dishes;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDishes();
    setRefreshing(false);
  }, []);

  const cartItems = activeCartIndex === 1 ? cart1 : cart2;
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const handleCheckout = () => {
    if (cartCount === 0) return;
    setShowCheckoutConfirm(true);
  };

  const confirmCheckout = async () => {
    setCheckoutLoading(true);
    try {
      await submitOrderWithLogging(cartItems, currentTable);
      clearAllCarts();
      await fetchTodayOrders();
      await fetchStats();
      setShowCheckoutConfirm(false);
    } catch (e: any) {
      console.error('Checkout error:', e);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isLoading && dishes.length === 0) return <Loading />;

  return (
    <View style={styles.container}>
      <FilterBar
        options={categories}
        activeOption={activeCategory}
        onSelect={setActiveCategory}
      />

      <FlatList
        data={filteredDishes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const items = activeCartIndex === 1 ? cart1 : cart2;
          const qty = items.find(i => i.dish.id === item.id)?.quantity ?? 0;
          return (
            <DishCard
              dish={item}
              quantity={qty}
              onAdd={() => addToCart(item)}
              onSubtract={() => updateQuantity(item.id, -1)}
            />
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        windowSize={5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        contentContainerStyle={{ paddingBottom: 8 }}
      />

      <View style={styles.tableBar}>
        <TouchableOpacity
          style={styles.tableBtn}
          onPress={() => { setTableInput(currentTable); setShowTableModal(true); }}
        >
          <Text style={styles.tableBtnText}>
            🪑 {currentTable === '自由' ? '自由入座' : `桌 ${currentTable}`}
          </Text>
        </TouchableOpacity>
      </View>

      <CartPanel onCheckout={handleCheckout} />

      <Modal
        visible={showTableModal}
        title="选择桌号"
        onCancel={() => setShowTableModal(false)}
        onConfirm={() => { setTable(tableInput); setShowTableModal(false); }}
      >
        <Input
          value={tableInput}
          onChangeText={setTableInput}
          placeholder="输入桌号或'自由'"
        />
      </Modal>

      <Modal
        visible={showCheckoutConfirm}
        title="确认结算"
        message={`${currentTable === '自由' ? '自由入座' : '桌号: ' + currentTable}\n共 ${cartCount} 项\n合计: ¥${cartItems.reduce((s, i) => s + i.dish.price * i.quantity, 0).toFixed(2)}`}
        confirmText="确认下单"
        onCancel={() => setShowCheckoutConfirm(false)}
        onConfirm={confirmCheckout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tableBar: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableBtn: { paddingVertical: 6 },
  tableBtnText: { fontSize: 14, color: '#374151' },
});