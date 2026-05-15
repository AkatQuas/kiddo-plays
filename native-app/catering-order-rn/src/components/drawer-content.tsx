import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/src/stores/app-store';

const DRAWER_WIDTH = 280;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface DrawerContentProps {
  slideAnim: Animated.Value;
}

export function DrawerContent({ slideAnim }: DrawerContentProps) {
  const insets = useSafeAreaInsets();
  const { currentMode, setDrawerOpen, setMode, setAuthenticating, checkInitialized } = useAppStore();

  const handleModeSwitch = () => {
    setDrawerOpen(false);
    if (currentMode === 'order') {
      setAuthenticating(true);
    } else {
      setMode('order');
    }
  };

  const handleTutorial = () => {
    setDrawerOpen(false);
    // Navigate to onboarding - will be handled by expo-router
  };

  const handleAbout = () => {
    setDrawerOpen(false);
    // Navigate to about - will be handled by expo-router
  };

  const handleExit = () => {
    setDrawerOpen(false);
    BackHandler.exitApp();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
          paddingTop: insets.top + 20,
        },
      ]}
    >
      <Text style={styles.title}>餐饮订单管理</Text>
      <View style={styles.divider} />

      <TouchableOpacity style={styles.menuItem} onPress={handleModeSwitch}>
        <Text style={styles.menuIcon}>{currentMode === 'order' ? '🔐' : '📋'}</Text>
        <Text style={styles.menuText}>
          {currentMode === 'order' ? '切换管理模式' : '切换接单模式'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={handleTutorial}>
        <Text style={styles.menuIcon}>📖</Text>
        <Text style={styles.menuText}>新手教程</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={handleAbout}>
        <Text style={styles.menuIcon}>ℹ️</Text>
        <Text style={styles.menuText}>关于我们</Text>
      </TouchableOpacity>

      <View style={styles.divider} />
      <TouchableOpacity style={styles.menuItem} onPress={handleExit}>
        <Text style={styles.menuIcon}>🚪</Text>
        <Text style={[styles.menuText, { color: '#EF4444' }]}>退出应用</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface DrawerOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function DrawerOverlay({ visible, onClose }: DrawerOverlayProps) {
  if (!visible) return null;
  return (
    <TouchableOpacity
      style={styles.overlay}
      activeOpacity={1}
      onPress={onClose}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    zIndex: 100,
    elevation: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuText: { fontSize: 16, color: '#374151' },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 99,
  },
});