import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/src/stores/app-store';

/**
 * Initial splash/redirect screen.
 * On mount, waits for the DB init check, then redirects to the correct first screen.
 * This prevents the "Unmatched Route" error when visiting /.
 */
export default function IndexScreen() {
  const router = useRouter();
  const { isInitialized, isLoading, checkInitialized } = useAppStore();

  useEffect(() => {
    checkInitialized();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!isInitialized) {
      router.replace('/init-config');
    } else {
      router.replace('/(order)/stats-brief');
    }
  }, [isLoading, isInitialized]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});