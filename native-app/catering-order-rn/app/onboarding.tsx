import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/button';
import { useAppStore } from '@/src/stores/app-store';

const { width } = Dimensions.get('window');

const steps = [
  {
    icon: '📋',
    title: '接单模式',
    desc: '在点菜页选择菜品，支持双购物车同时结算，订单实时同步到订单列表。',
  },
  {
    icon: '🔐',
    title: '管理模式',
    desc: '通过侧边菜单切换到管理模式，查看数据统计、管理菜品、系统设置。',
  },
  {
    icon: '📊',
    title: '数据统计',
    desc: '管理模式查看日/周/月/年营收曲线和菜品销量排行，支持导出Excel报表。',
  },
  {
    icon: '💾',
    title: '数据安全',
    desc: '所有数据本地存储，支持备份恢复到手机存储，密码加密保护。',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { setOnboardingCompleted } = useAppStore();

  const handleNext = () => {
    if (currentIndex < steps.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleFinish = async () => {
    await setOnboardingCompleted();
    router.replace('/disclaimer');
  };

  const handleSkip = async () => {
    await setOnboardingCompleted();
    router.replace('/disclaimer');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>跳过</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={steps}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.activeDot]}
            />
          ))}
        </View>
        {currentIndex < steps.length - 1 ? (
          <Button title="下一步" onPress={handleNext} />
        ) : (
          <Button title="开始使用" onPress={handleFinish} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  skipBtn: { alignSelf: 'flex-end', padding: 16, zIndex: 10 },
  skipText: { fontSize: 14, color: '#6B7280' },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  desc: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  footer: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  activeDot: { backgroundColor: '#2563EB', width: 24 },
});