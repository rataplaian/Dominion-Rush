import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UNIT_BY_ID } from '../game';

interface CardBarProps {
  cardIds: string[];
  mana: number;
  selectedCardId: string;
  onSelect: (id: string) => void;
}

export function CardBar({ cardIds, mana, selectedCardId, onSelect }: CardBarProps) {
  return (
    <View>
      <Text style={styles.label}>HAND</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {cardIds.map((id, index) => {
          const definition = UNIT_BY_ID[id];
          if (!definition) return null;
          const selected = selectedCardId === id;
          const affordable = mana + 1e-9 >= definition.manaCost;

          return (
            <Pressable
              key={`${id}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(id)}
              style={({ pressed }) => [
                styles.card,
                selected ? styles.selected : null,
                !affordable ? styles.unaffordable : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.icon}>{definition.icon}</Text>
              <Text style={styles.name} numberOfLines={1}>{definition.name}</Text>
              <Text style={styles.cost}>{definition.manaCost} ◈</Text>
              <Text style={styles.type}>{definition.kind === 'structure' ? 'STRUCTURE' : definition.attackType.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: '#9eacc3', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  content: { gap: 8, paddingRight: 12 },
  card: {
    width: 92,
    minHeight: 92,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38445a',
    backgroundColor: '#1b2230',
    justifyContent: 'space-between',
  },
  selected: { borderColor: '#6fb6df', borderWidth: 2, backgroundColor: '#1d3143' },
  unaffordable: { opacity: 0.48 },
  pressed: { transform: [{ scale: 0.98 }] },
  icon: { fontSize: 22 },
  name: { color: '#f6f8fc', fontWeight: '800', fontSize: 11 },
  cost: { color: '#c6a8ff', fontWeight: '900', fontSize: 12 },
  type: { color: '#7f8da5', fontSize: 8, fontWeight: '700' },
});
