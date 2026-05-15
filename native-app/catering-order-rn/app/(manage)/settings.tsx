import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { useConfigStore } from '@/src/stores/config-store';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Loading } from '@/src/components/ui/loading';
import { Modal } from '@/src/components/ui/modal';
import { Toast } from '@/src/components/ui/toast';
import { backupDatabase, restoreDatabase } from '@/src/services/backup-service';
import { hashPassword } from '@/src/services/auth-service';
import { getConfig, updateConfig } from '@/src/db/repositories/config-repository';
import { logOperation } from '@/src/db/repositories/operation-log-repository';

export default function SettingsScreen() {
  const { shopName, tableCount, bioUnlock, timeoutSeconds, isLoading, loadConfig, updateShopConfig } = useConfigStore();

  const [editShopName, setEditShopName] = useState('');
  const [editTableCount, setEditTableCount] = useState('');
  const [editTimeout, setEditTimeout] = useState('');
  const [bioSwitch, setBioSwitch] = useState(false);

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');

  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePath, setRestorePath] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    setEditShopName(shopName);
    setEditTableCount(String(tableCount));
    setEditTimeout(String(timeoutSeconds));
    setBioSwitch(bioUnlock);
  }, [shopName, tableCount, timeoutSeconds, bioUnlock]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleSaveShop = async () => {
    await updateShopConfig({
      shop_name: editShopName,
      table_num: parseInt(editTableCount) || 99,
      timeout_time: parseInt(editTimeout) || 300,
    });
    showToast('配置已保存', 'success');
  };

  const handleBioToggle = async (value: boolean) => {
    setBioSwitch(value);
    await updateShopConfig({ bio_unlock: value ? 1 : 0 });
    showToast(value ? '生物识别已开启' : '生物识别已关闭');
  };

  const handlePwdChange = async () => {
    setPwdError('');
    if (newPwd.length < 4) { setPwdError('密码至少4位'); return; }
    if (newPwd !== confirmNewPwd) { setPwdError('两次密码不一致'); return; }
    try {
      const config = await getConfig();
      if (!config) { setPwdError('系统错误'); return; }
      const hash = await hashPassword(oldPwd);
      if (hash !== config.admin_pwd) { setPwdError('原密码错误'); return; }

      const newHash = await hashPassword(newPwd);
      await updateConfig({ admin_pwd: newHash });
      await logOperation('password_change', '管理员密码修改');
      setShowPwdModal(false);
      setOldPwd('');
      setNewPwd('');
      setConfirmNewPwd('');
      showToast('密码已修改', 'success');
    } catch (e: any) {
      setPwdError('密码修改失败');
    }
  };

  const handleBackup = async () => {
    try {
      const path = await backupDatabase();
      showToast(`备份成功: ${path.name}`, 'success');
    } catch (e: any) {
      showToast('备份失败', 'error');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreDatabase(restorePath);
      showToast('数据已恢复，请重启应用', 'success');
      setShowRestoreModal(false);
    } catch (e: any) {
      showToast('恢复失败，请检查备份文件', 'error');
    }
  };

  if (isLoading) return <Loading />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Shop Config */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>店铺配置</Text>
        <Input label="店铺名称" value={editShopName} onChangeText={setEditShopName} />
        <Input label="桌位数" value={editTableCount} onChangeText={setEditTableCount} keyboardType="numeric" />
        <Input label="超时时间(秒)" value={editTimeout} onChangeText={setEditTimeout} keyboardType="numeric" />
        <Button title="保存配置" onPress={handleSaveShop} style={{ marginTop: 8 }} />
      </Card>

      {/* Security */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>安全设置</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>生物识别解锁</Text>
          <Switch value={bioSwitch} onValueChange={handleBioToggle} />
        </View>
        <Button title="修改密码" onPress={() => setShowPwdModal(true)} variant="secondary" />
      </Card>

      {/* Backup */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>数据备份</Text>
        <Text style={styles.hint}>备份数据库文件到本地存储，支持分享和恢复</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          <Button title="创建备份" onPress={handleBackup} variant="primary" />
        </View>
      </Card>

      {/* About */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>关于</Text>
        <Text style={styles.hint}>餐饮订单管理 v1.0.0</Text>
        <Text style={styles.hint}>纯本地离线应用</Text>
      </Card>

      {/* Password Modal */}
      <Modal
        visible={showPwdModal}
        title="修改密码"
        confirmText="确认修改"
        onCancel={() => setShowPwdModal(false)}
        onConfirm={handlePwdChange}
      >
        <Input label="原密码" value={oldPwd} onChangeText={setOldPwd} secureTextEntry />
        <Input label="新密码" value={newPwd} onChangeText={setNewPwd} secureTextEntry />
        <Input label="确认新密码" value={confirmNewPwd} onChangeText={setConfirmNewPwd} secureTextEntry />
        {pwdError && <Text style={styles.error}>{pwdError}</Text>}
      </Modal>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  section: { marginBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  hint: { fontSize: 13, color: '#9CA3AF', marginBottom: 4 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: { fontSize: 14, color: '#374151' },
  error: { color: '#EF4444', fontSize: 13, textAlign: 'center' },
});