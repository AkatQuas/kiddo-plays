import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { StatsCard } from '@/src/components/stats-card';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Loading } from '@/src/components/ui/loading';
import { useOrderListStore } from '@/src/stores/order-list-store';

export default function StatsBriefScreen() {
  const { todayStats, fetchStats, isLoading } = useOrderListStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, []);

  if (isLoading && !refreshing && todayStats.totalOrder === 0) {
    return <Loading />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.row}>
        <StatsCard label="今日订单" value={todayStats.totalOrder} />
        <StatsCard label="今日营收" value={`¥${todayStats.totalMoney.toFixed(2)}`} />
      </View>
      <View style={styles.row}>
        <StatsCard
          label="热销菜品"
          value={todayStats.popularDish || '暂无'}
          subtitle={todayStats.popularDish ? '今日最受欢迎' : undefined}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 12, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
});