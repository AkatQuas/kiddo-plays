import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from '@/src/stores/app-store';
import { DrawerContent, DrawerOverlay } from '@/src/components/drawer-content';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function RootLayout() {
  const slideAnim = useRef(new Animated.Value(-280)).current;
  const { isDrawerOpen, setDrawerOpen } = useAppStore();

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isDrawerOpen ? 0 : -280,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isDrawerOpen]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="init-config" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="disclaimer" />
          <Stack.Screen name="(order)" />
          <Stack.Screen name="(manage)" />
          <Stack.Screen
            name="password-verify"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="about" />
        </Stack>

        <DrawerOverlay visible={isDrawerOpen} onClose={() => setDrawerOpen(false)} />
        <DrawerContent slideAnim={slideAnim} />

        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}