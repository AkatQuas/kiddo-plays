import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { getConfig } from '@/src/db/repositories/config-repository';
import { verifyPassword } from '@/src/services/auth-service';
import { useAppStore } from '@/src/stores/app-store';

export default function PasswordVerifyScreen() {
  const router = useRouter();
  const { setMode, setAuthenticating } = useAppStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBioAvailable(compatible && enrolled);
  };

  const handleBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: '验证身份以进入管理模式',
      fallbackLabel: '使用密码',
    });
    if (result.success) {
      handleSuccess();
    }
  };

  const handlePassword = async () => {
    if (locked) return;
    if (attempts >= 5) {
      setLocked(true);
      setError('错误次数过多，请5分钟后重试');
      setTimeout(() => setLocked(false), 5 * 60 * 1000);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const config = await getConfig();
      if (!config) {
        setError('系统配置异常');
        return;
      }
      const valid = await verifyPassword(password, config.admin_pwd);
      if (valid) {
        handleSuccess();
      } else {
        setAttempts(a => a + 1);
        setError(`密码错误，剩余 ${4 - attempts} 次机会`);
      }
    } catch (e: any) {
      setError('验证失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setMode('manage');
    setAuthenticating(false);
    router.replace('/(manage)/data-analytics');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>验证身份</Text>
      <Text style={styles.subtitle}>请输入管理员密码</Text>

      <Input
        value={password}
        onChangeText={(t) => { setPassword(t); setError(''); }}
        placeholder="管理员密码"
        secureTextEntry
        error={error}
      />

      {locked && (
        <Text style={styles.locked}>账户已锁定，请5分钟后再试</Text>
      )}

      <Button
        title="确认"
        onPress={handlePassword}
        loading={loading}
        disabled={!password || locked}
        style={{ marginTop: 8 }}
      />

      {bioAvailable && (
        <Button
          title="指纹/面容解锁"
          onPress={handleBiometric}
          variant="secondary"
          style={{ marginTop: 12 }}
        />
      )}

      <Button
        title="返回"
        onPress={() => {
          setAuthenticating(false);
          router.back();
        }}
        variant="ghost"
        style={{ marginTop: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  locked: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 },
});