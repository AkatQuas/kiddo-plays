import React from 'react';
import { Tabs } from 'expo-router';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '@/src/stores/app-store';

export default function ManageLayout() {
  const { setDrawerOpen } = useAppStore();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#059669' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        headerLeft: () => (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setDrawerOpen(true)}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          height: 56,
          paddingBottom: 4,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderColor: '#E5E7EB',
        },
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="data-analytics"
        options={{
          title: '统计',
          headerTitle: '数据统计',
          tabBarLabel: '统计',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="menu-management"
        options={{
          title: '菜单',
          headerTitle: '物料管理',
          tabBarLabel: '菜单',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📝</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          headerTitle: '设置中心',
          tabBarLabel: '设置',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  menuBtn: { paddingLeft: 16, paddingRight: 8 },
  menuIcon: { fontSize: 22, color: '#fff' },
});