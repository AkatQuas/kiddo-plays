import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type BadgeVariant = 'paid' | 'unpaid' | 'refunded' | 'soldout' | 'default';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  paid: { bg: '#D1FAE5', color: '#065F46' },
  unpaid: { bg: '#FEF3C7', color: '#92400E' },
  refunded: { bg: '#FEE2E2', color: '#991B1B' },
  soldout: { bg: '#E5E7EB', color: '#4B5563' },
  default: { bg: '#DBEAFE', color: '#1E40AF' },
};

export function Badge({ text, variant = 'default' }: BadgeProps) {
  const vs = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: vs.bg }]}>
      <Text style={[styles.text, { color: vs.color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '500' },
});