import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useDishStore } from '@/src/stores/dish-store';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Modal } from '@/src/components/ui/modal';
import { Badge } from '@/src/components/ui/badge';
import { Loading } from '@/src/components/ui/loading';
import { EmptyState } from '@/src/components/ui/empty-state';
import { logOperation } from '@/src/db/repositories/operation-log-repository';
import type { Dish } from '@/src/db/repositories/dish-repository';

export default function MenuManagementScreen() {
  const { dishes, isLoading, fetchDishes, addDish, editDish, removeDish, toggleSoldOut } = useDishStore();
  const [refreshing, setRefreshing] = useState(false);

  // Add dish modal
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addStock, setAddStock] = useState('0');

  // Edit dish modal
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');

  // Delete confirm
  const [showDelete, setShowDelete] = useState(false);
  const [deletingDish, setDeletingDish] = useState<Dish | null>(null);

  useEffect(() => {
    fetchDishes();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDishes();
    setRefreshing(false);
  }, []);

  const handleAdd = async () => {
    if (!addName.trim() || !addPrice) return;
    await addDish(addName.trim(), parseFloat(addPrice), null, parseInt(addStock) || 0);
    await logOperation('dish_create', `新增菜品: ${addName}, 价格: ${addPrice}`);
    setShowAdd(false);
    setAddName('');
    setAddPrice('');
    setAddStock('0');
  };

  const handleEdit = async () => {
    if (!editingDish) return;
    await editDish(editingDish.id, {
      dish_name: editName,
      price: parseFloat(editPrice),
      stock_num_daily: parseInt(editStock) || 0,
    });
    await logOperation('dish_update', `修改菜品: ${editingDish.id}`);
    setEditingDish(null);
  };

  const handleDelete = async () => {
    if (!deletingDish) return;
    await removeDish(deletingDish.id);
    await logOperation('dish_delete', `删除菜品: ${deletingDish.dish_name}`);
    setShowDelete(false);
    setDeletingDish(null);
  };

  if (isLoading && dishes.length === 0) return <Loading />;

  return (
    <View style={styles.container}>
      <Button
        title="+ 新增菜品"
        onPress={() => setShowAdd(true)}
        style={{ margin: 12 }}
      />

      <FlatList
        data={dishes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Card style={styles.dishCard}>
            <View style={styles.dishHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.dishName}>{item.dish_name}</Text>
                  {item.is_sold_out_today === 1 && <Badge text="售罄" variant="soldout" />}
                </View>
                <Text style={styles.dishPrice}>¥{item.price.toFixed(2)}</Text>
                <Text style={styles.dishStock}>库存: {item.stock_num_daily}</Text>
              </View>
              <View style={styles.dishActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={async () => {
                    await toggleSoldOut(item.id);
                    await logOperation('dish_toggle_soldout', `菜品: ${item.dish_name}`);
                  }}
                >
                  <Text style={styles.actionText}>
                    {item.is_sold_out_today === 1 ? '上架' : '售罄'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setEditingDish(item);
                    setEditName(item.dish_name);
                    setEditPrice(item.price.toString());
                    setEditStock(item.stock_num_daily.toString());
                  }}
                >
                  <Text style={styles.actionText}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                  onPress={() => {
                    setDeletingDish(item);
                    setShowDelete(true);
                  }}
                >
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={dishes.length === 0 ? { flex: 1 } : { padding: 12, gap: 8 }}
        ListEmptyComponent={<EmptyState title="暂无菜品" message="点击上方按钮添加菜品" />}
      />

      {/* Add Dish Modal */}
      <Modal
        visible={showAdd}
        title="新增菜品"
        confirmText="保存"
        onCancel={() => setShowAdd(false)}
        onConfirm={handleAdd}
      >
        <Input label="菜品名称" value={addName} onChangeText={setAddName} placeholder="例如：鱼香肉丝" />
        <Input label="价格" value={addPrice} onChangeText={setAddPrice} placeholder="0.00" keyboardType="numeric" />
        <Input label="每日库存" value={addStock} onChangeText={setAddStock} placeholder="0" keyboardType="numeric" />
      </Modal>

      {/* Edit Dish Modal */}
      <Modal
        visible={!!editingDish}
        title="编辑菜品"
        confirmText="保存"
        onCancel={() => setEditingDish(null)}
        onConfirm={handleEdit}
      >
        <Input label="菜品名称" value={editName} onChangeText={setEditName} />
        <Input label="价格" value={editPrice} onChangeText={setEditPrice} keyboardType="numeric" />
        <Input label="每日库存" value={editStock} onChangeText={setEditStock} keyboardType="numeric" />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        visible={showDelete}
        title="确认删除"
        message={`确定要删除「${deletingDish?.dish_name}」吗？此操作为逻辑删除，历史数据不受影响。`}
        variant="danger"
        confirmText="确认删除"
        onCancel={() => setShowDelete(false)}
        onConfirm={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  dishCard: { marginBottom: 0 },
  dishHeader: { flexDirection: 'row' },
  dishName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  dishPrice: { fontSize: 14, color: '#EF4444', fontWeight: '600', marginTop: 4 },
  dishStock: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  dishActions: { gap: 4 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  actionText: { fontSize: 12, color: '#374151' },
});