import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { useConfigStore } from '@/src/stores/config-store';
import { useAppStore } from '@/src/stores/app-store';

export default function InitConfigScreen() {
  const router = useRouter();
  const { initConfig } = useConfigStore();
  const { checkInitialized } = useAppStore();

  const [shopName, setShopName] = useState('');
  const [tableCount, setTableCount] = useState('99');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!shopName.trim()) errs.shopName = '请输入店铺名称';
    if (!tableCount.trim() || parseInt(tableCount) < 1) errs.tableCount = '请输入有效桌数';
    if (password.length < 4) errs.password = '密码至少4位';
    if (password !== confirmPwd) errs.confirmPwd = '两次密码不一致';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await initConfig(shopName.trim(), parseInt(tableCount), password);
      await checkInitialized();
      router.replace('/onboarding');
    } catch (e: any) {
      setErrors({ submit: '保存失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>初始化设置</Text>
        <Text style={styles.subtitle}>首次使用请完成店铺配置</Text>

        <Input
          label="店铺名称"
          value={shopName}
          onChangeText={setShopName}
          placeholder="例如：老王川菜馆"
          error={errors.shopName}
        />

        <Input
          label="桌位数量"
          value={tableCount}
          onChangeText={setTableCount}
          placeholder="99"
          keyboardType="numeric"
          error={errors.tableCount}
        />

        <Input
          label="管理员密码"
          value={password}
          onChangeText={setPassword}
          placeholder="至少4位密码"
          secureTextEntry
          error={errors.password}
        />

        <Input
          label="确认密码"
          value={confirmPwd}
          onChangeText={setConfirmPwd}
          placeholder="再次输入密码"
          secureTextEntry
          error={errors.confirmPwd}
        />

        {errors.submit && (
          <Text style={styles.error}>{errors.submit}</Text>
        )}

        <Button
          title="完成初始化"
          onPress={handleSubmit}
          loading={loading}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  error: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 },
});