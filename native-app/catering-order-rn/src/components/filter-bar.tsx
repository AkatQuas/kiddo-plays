import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface FilterBarProps {
  options: string[];
  activeOption: string;
  onSelect: (option: string) => void;
}

export function FilterBar({ options, activeOption, onSelect }: FilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {options.map(option => (
        <TouchableOpacity
          key={option}
          style={[styles.chip, activeOption === option && styles.activeChip]}
          onPress={() => onSelect(option)}
        >
          <Text style={[styles.chipText, activeOption === option && styles.activeChipText]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { maxHeight: 40 },
  content: { paddingHorizontal: 12, gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeChip: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 13, color: '#6B7280' },
  activeChipText: { color: '#fff', fontWeight: '500' },
});