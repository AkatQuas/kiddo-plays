import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatsCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

export function StatsCard({ label, value, subtitle }: StatsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
});