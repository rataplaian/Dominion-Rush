import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UNIT_BY_ID } from '../game';

interface CardBarProps {
  cardIds: string[];
  mana: number;
  selectedCardId: string;
  onSelect: (id: string) => void;
}

function rangeLabel(range: number, attackType: string): string {
  if (attackType === 'none') return 'NO ATK';
  return `RNG ${range}`;
}

export function CardBar({ cardIds, mana, selectedCardId, onSelect }: CardBarProps) {
  return (
    <View>
      <Text style={styles.label}>HAND · TAP A CARD FOR DETAILS</Text>
      <View style={styles.content}>
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
              <View style={styles.topRow}>
                <Text style={styles.icon}>{definition.icon}</Text>
                <Text style={styles.cost}>{definition.manaCost} ◈</Text>
              </View>

              <Text style={styles.name} numberOfLines={2}>
                {definition.name}
              </Text>

              <View style={styles.statStack}>
                <Text style={styles.stat}>HP {definition.maxHp}</Text>
                <Text style={styles.stat}>{rangeLabel(definition.range, definition.attackType)}</Text>
                <Text style={styles.stat}>
                  {definition.attackType === 'none' ? 'DMG —' : `DMG ${definition.attackDamage}`}
                </Text>
                <Text style={styles.stat}>
                  {definition.advanceCooldownMs ? `MOVE ${definition.advanceCooldownMs / 1000}s` : 'STATIC'}
                </Text>
              </View>

              <Text style={styles.type} numberOfLines={1}>
                {definition.kind === 'structure' ? 'STRUCTURE' : definition.attackType.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#9eacc3',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  content: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'stretch',
  },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 116,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38445a',
    backgroundColor: '#1b2230',
    justifyContent: 'space-between',
  },
  selected: {
    borderColor: '#6fb6df',
    borderWidth: 2,
    backgroundColor: '#1d3143',
  },
  unaffordable: { opacity: 0.48 },
  pressed: { transform: [{ scale: 0.98 }] },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 2,
  },
  icon: { fontSize: 18 },
  name: {
    color: '#f6f8fc',
    fontWeight: '800',
    fontSize: 9,
    lineHeight: 11,
    minHeight: 22,
  },
  cost: {
    color: '#c6a8ff',
    fontWeight: '900',
    fontSize: 10,
  },
  statStack: {
    gap: 1,
  },
  stat: {
    color: '#a8b5c7',
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '800',
  },
  type: {
    color: '#7f8da5',
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '700',
  },
});
