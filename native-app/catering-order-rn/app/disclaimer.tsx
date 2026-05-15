import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/button';
import { useAppStore } from '@/src/stores/app-store';

export default function DisclaimerScreen() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const { setDisclaimerAccepted } = useAppStore();

  const handleAgree = async () => {
    await setDisclaimerAccepted();
    router.replace('/(order)/stats-brief');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>免责声明</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.paragraph}>
          本应用为个人独立开发，仅供餐饮门店内部管理使用，不构成任何商业软件许可。
        </Text>
        <Text style={styles.paragraph}>
          1. 本应用所有数据均存储在本地设备，开发者不会收集、上传或分享任何用户数据。
        </Text>
        <Text style={styles.paragraph}>
          2. 用户应自行负责数据备份，因设备损坏、系统故障导致的数据丢失，开发者不承担责任。
        </Text>
        <Text style={styles.paragraph}>
          3. 本应用不保证完全无错误，开发者保留随时更新、修改或停止服务的权利。
        </Text>
        <Text style={styles.paragraph}>
          4. 使用本应用即表示同意以上条款。如不同意，请立即停止使用并卸载本应用。
        </Text>
      </ScrollView>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setAgreed(!agreed)}
      >
        <View style={[styles.checkbox, agreed && styles.checked]}>
          {agreed && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>我已阅读并同意以上条款</Text>
      </TouchableOpacity>

      <Button
        title="进入应用"
        onPress={handleAgree}
        disabled={!agreed}
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },
  paragraph: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checked: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: '#374151' },
});