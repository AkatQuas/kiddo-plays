import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const bgColor = getBgColor(variant, disabled || loading);
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: bgColor }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[styles.text, variant === 'ghost' && { color: '#333' }]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function getBgColor(variant: ButtonVariant, inactive: boolean): string {
  if (inactive) return '#ccc';
  switch (variant) {
    case 'primary':
      return '#2563EB';
    case 'secondary':
      return '#6B7280';
    case 'danger':
      return '#EF4444';
    case 'ghost':
      return 'transparent';
  }
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});