import React from 'react';
import { Tabs } from 'expo-router';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '@/src/stores/app-store';

export default function OrderLayout() {
  const { setDrawerOpen } = useAppStore();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#2563EB' },
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
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="stats-brief"
        options={{
          title: '简报',
          headerTitle: '今日简报',
          tabBarLabel: '简报',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="order-taking"
        options={{
          title: '点菜',
          headerTitle: '点菜',
          tabBarLabel: '点菜',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🍽️</Text>,
        }}
      />
      <Tabs.Screen
        name="order-list"
        options={{
          title: '订单',
          headerTitle: '今日订单',
          tabBarLabel: '订单',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  menuBtn: { paddingLeft: 16, paddingRight: 8 },
  menuIcon: { fontSize: 22, color: '#fff' },
});