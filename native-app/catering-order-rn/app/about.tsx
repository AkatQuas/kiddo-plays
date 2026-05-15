import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/src/components/ui/button';
import { useRouter } from 'expo-router';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.appName}>餐饮订单管理</Text>
      <Text style={styles.version}>版本 1.0.0</Text>
      <Text style={styles.desc}>纯本地离线餐饮订单管理工具</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>免责声明</Text>
        <Text style={styles.text}>
          本应用为个人独立开发，仅供餐饮门店内部管理使用。所有数据存储在本地设备，
          开发者不收集任何用户数据。用户应自行负责数据备份，因设备损坏、
          系统故障导致的数据丢失，开发者不承担责任。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>技术栈</Text>
        <Text style={styles.text}>
          React Native / Expo / SQLite / Zustand
        </Text>
      </View>

      <Button
        title="返回"
        onPress={() => router.back()}
        variant="ghost"
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 60, alignItems: 'center' },
  appName: { fontSize: 24, fontWeight: '700', color: '#111827' },
  version: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  desc: { fontSize: 14, color: '#9CA3AF', marginTop: 8, marginBottom: 32 },
  section: { width: '100%', marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  text: { fontSize: 14, color: '#6B7280', lineHeight: 22 },
});