import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useStatsStore } from '@/src/stores/stats-store';
import { StatsCard } from '@/src/components/stats-card';
import { FilterBar } from '@/src/components/filter-bar';
import { Button } from '@/src/components/ui/button';
import { Loading } from '@/src/components/ui/loading';
import { EmptyState } from '@/src/components/ui/empty-state';
import { shareBackup } from '@/src/services/backup-service';

const timeRanges = ['日', '周', '月', '年'];

export default function DataAnalyticsScreen() {
  const {
    dateRange, revenueData, dishDistribution, isLoading,
    fetchDetailedStats, setDateRange,
  } = useStatsStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDetailedStats(dateRange);
  }, [dateRange]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDetailedStats(dateRange);
    setRefreshing(false);
  }, [dateRange]);

  const totalRevenue = revenueData.reduce((s, d) => s + d.amount, 0);
  const totalSales = dishDistribution.reduce((s, d) => s + d.sales, 0);

  if (isLoading && revenueData.length === 0) return <Loading />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <FilterBar
        options={timeRanges}
        activeOption={
          dateRange === 'day' ? '日' :
          dateRange === 'week' ? '周' :
          dateRange === 'month' ? '月' : '年'
        }
        onSelect={(opt) => {
          const map: Record<string, 'day' | 'week' | 'month' | 'year'> = {
            '日': 'day', '周': 'week', '月': 'month', '年': 'year',
          };
          setDateRange(map[opt]);
        }}
      />

      <View style={styles.row}>
        <StatsCard label="总营收" value={`¥${totalRevenue.toFixed(2)}`} />
        <StatsCard label="总销量" value={totalSales} />
      </View>

      {/* Revenue Trend */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>营收趋势</Text>
        {revenueData.length === 0 ? (
          <EmptyState title="暂无数据" message="该时间段没有订单数据" />
        ) : (
          revenueData.map((d, i) => (
            <View key={i} style={styles.barRow}>
              <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${Math.min((d.amount / Math.max(...revenueData.map(x => x.amount))) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>¥{d.amount.toFixed(0)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Dish Distribution */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>菜品销量排行</Text>
        {dishDistribution.length === 0 ? (
          <EmptyState title="暂无数据" message="该时间段没有菜品销售数据" />
        ) : (
          dishDistribution.slice(0, 10).map((d, i) => (
            <View key={i} style={styles.barRow}>
              <Text style={styles.rankLabel}>{i + 1}. {d.name}</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.bar,
                    styles.dishBar,
                    {
                      width: `${Math.min((d.sales / Math.max(...dishDistribution.map(x => x.sales))) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{d.sales}</Text>
            </View>
          ))
        )}
      </View>

      <Button
        title="导出 Excel 报表"
        onPress={async () => {
          try {
            await shareBackup();
          } catch (e: any) {
            console.error('Export error:', e);
          }
        }}
        variant="secondary"
        style={{ marginTop: 16 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  chartSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: { width: 40, fontSize: 12, color: '#6B7280' },
  rankLabel: { flex: 1, fontSize: 12, color: '#374151' },
  barBg: {
    flex: 1,
    height: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
    minWidth: 4,
  },
  dishBar: { backgroundColor: '#10B981' },
  barValue: { width: 50, fontSize: 12, color: '#6B7280', textAlign: 'right' },
});