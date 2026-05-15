import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useOrderListStore } from '@/src/stores/order-list-store';
import { OrderCard } from '@/src/components/order-card';
import { FilterBar } from '@/src/components/filter-bar';
import { Loading } from '@/src/components/ui/loading';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Modal } from '@/src/components/ui/modal';
import { Input } from '@/src/components/ui/input';
import type { Order } from '@/src/db/repositories/order-repository';

const filters = ['全部', '未支付', '已支付', '已退款'];

export default function OrderListScreen() {
  const {
    orders, activeFilter, isLoading,
    fetchTodayOrders, setFilter, getFilteredOrders,
    confirmPayment, processRefund, getOrderItems,
  } = useOrderListStore();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, any[]>>({});
  const [showPayModal, setShowPayModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refundRemark, setRefundRemark] = useState('');
  const [refundMethod, setRefundMethod] = useState('现金');

  useEffect(() => {
    fetchTodayOrders();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTodayOrders();
    setRefreshing(false);
  }, []);

  const handleExpand = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderItemsMap[orderId]) {
      const items = await getOrderItems(orderId);
      setOrderItemsMap(prev => ({ ...prev, [orderId]: items }));
    }
  };

  const handleConfirmPay = (orderId: number) => {
    setSelectedOrder(orders.find(o => o.id === orderId) ?? null);
    setShowPayModal(true);
  };

  const doConfirmPay = async () => {
    if (!selectedOrder) return;
    await confirmPayment(selectedOrder.id);
    setShowPayModal(false);
    setSelectedOrder(null);
  };

  const handleRefund = (order: Order) => {
    setSelectedOrder(order);
    setRefundRemark('');
    setShowRefundModal(true);
  };

  const doRefund = async () => {
    if (!selectedOrder) return;
    await processRefund(selectedOrder.id, refundRemark, refundMethod);
    setShowRefundModal(false);
    setSelectedOrder(null);
  };

  const filteredOrders = getFilteredOrders();

  if (isLoading && orders.length === 0) return <Loading />;

  return (
    <View style={styles.container}>
      <FilterBar
        options={filters}
        activeOption={activeFilter}
        onSelect={setFilter}
      />

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            items={orderItemsMap[item.id] ?? []}
            onConfirmPayment={handleConfirmPay}
            onRefund={handleRefund}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        windowSize={5}
        removeClippedSubviews={true}
        contentContainerStyle={filteredOrders.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        ListEmptyComponent={
          <EmptyState title="暂无订单" message="今日还没有订单" />
        }
      />

      <Modal
        visible={showPayModal}
        title="确认收款"
        message={`确认订单 #${selectedOrder?.order_no.slice(-8)} 已收款？`}
        confirmText="确认收款"
        onCancel={() => setShowPayModal(false)}
        onConfirm={doConfirmPay}
      />

      <Modal
        visible={showRefundModal}
        title="退款"
        variant="danger"
        confirmText="确认退款"
        onCancel={() => setShowRefundModal(false)}
        onConfirm={doRefund}
      >
        <Input
          value={refundRemark}
          onChangeText={setRefundRemark}
          placeholder="退款原因（选填）"
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
});