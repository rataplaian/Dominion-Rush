import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UNIT_BY_ID } from '../game';

interface DeckLibraryProps {
  deckIds: readonly string[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function effectText(id: string): string {
  const unit = UNIT_BY_ID[id];
  if (unit.chargeBonus) {
    return `Charge: first melee hit after moving deals +${Math.round(unit.chargeBonus * 100)}% damage.`;
  }
  if (unit.splashFactor) {
    return `Splash: adjacent enemies take ${Math.round(unit.splashFactor * 100)}% of the main hit.`;
  }
  if (unit.advanceCooldownMs) {
    return `Movement charge: after ${unit.advanceCooldownMs / 1000}s the side arrow is ready. Tap the unit to advance 1 cell for free if the next cell is clear.`;
  }
  if (unit.attackType === 'none') {
    return 'Blocker: cannot attack or move.';
  }
  return 'No special effect.';
}

function moveText(id: string): string {
  const unit = UNIT_BY_ID[id];
  return unit.advanceCooldownMs ? `Free move / ${unit.advanceCooldownMs / 1000}s` : 'Static';
}

function attackCdText(id: string): string {
  const unit = UNIT_BY_ID[id];
  if (unit.attackType === 'none') return '—';
  return `${(unit.attackCooldownMs / 1000).toFixed(unit.attackCooldownMs % 1000 === 0 ? 0 : 1)}s`;
}

export function DeckLibrary({ deckIds, selectedId, onSelect }: DeckLibraryProps) {
  const selected = UNIT_BY_ID[selectedId] ?? UNIT_BY_ID[deckIds[0]];

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>YOUR DECK · UNIT LIBRARY</Text>
      <Text style={styles.help}>Tap any unit to inspect exact numbers and effects before the match.</Text>

      <View style={styles.grid}>
        {deckIds.map((id) => {
          const unit = UNIT_BY_ID[id];
          if (!unit) return null;
          const active = selected?.id === id;

          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(id)}
              style={({ pressed }) => [
                styles.card,
                active ? styles.cardSelected : null,
                pressed ? styles.cardPressed : null,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.icon}>{unit.icon}</Text>
                <Text style={styles.mana}>{unit.manaCost} ◈</Text>
              </View>
              <Text style={styles.name}>{unit.name}</Text>
              <Text style={styles.quick}>
                HP {unit.maxHp} · DMG {unit.attackType === 'none' ? '—' : unit.attackDamage} · RNG {unit.attackType === 'none' ? '—' : unit.range}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <View style={styles.detail}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailIcon}>{selected.icon}</Text>
            <View style={styles.detailTitleWrap}>
              <Text style={styles.detailName}>{selected.name.toUpperCase()}</Text>
              <Text style={styles.detailRole}>
                {selected.kind.toUpperCase()} · {selected.attackType.toUpperCase()} · {selected.manaCost} MANA
              </Text>
            </View>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statLabel}>HP</Text><Text style={styles.statValue}>{selected.maxHp}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>DAMAGE</Text><Text style={styles.statValue}>{selected.attackType === 'none' ? '—' : selected.attackDamage}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>RANGE</Text><Text style={styles.statValue}>{selected.attackType === 'none' ? '—' : `${selected.range} cells`}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>ATTACK CD</Text><Text style={styles.statValue}>{attackCdText(selected.id)}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>MOVEMENT</Text><Text style={styles.statValue}>{moveText(selected.id)}</Text></View>
          </View>

          <Text style={styles.effect}>{effectText(selected.id)}</Text>
          <Text style={styles.description}>{selected.description}</Text>
          <Text style={styles.rangeHelp}>
            Range is counted forward in the same column. A Range 4 unit can attack targets up to four cells ahead.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 6, gap: 7 },
  title: { color: '#dbe7f4', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  help: { color: '#74839a', fontSize: 9, lineHeight: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: {
    width: '48%',
    minWidth: 130,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#303b50',
    borderRadius: 9,
    backgroundColor: '#171e2a',
    padding: 8,
  },
  cardSelected: { borderColor: '#6fb6df', backgroundColor: '#1d3143' },
  cardPressed: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { fontSize: 20 },
  mana: { color: '#c6a8ff', fontSize: 10, fontWeight: '900' },
  name: { color: '#f2f5fa', fontSize: 10, fontWeight: '900', marginTop: 3 },
  quick: { color: '#8290a5', fontSize: 8, marginTop: 3 },
  detail: { backgroundColor: '#0f1621', borderRadius: 10, padding: 10, gap: 8, borderWidth: 1, borderColor: '#2b3a4d' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { fontSize: 27 },
  detailTitleWrap: { flex: 1 },
  detailName: { color: '#f6f8fc', fontSize: 12, fontWeight: '900' },
  detailRole: { color: '#7f8da5', fontSize: 8, fontWeight: '800', marginTop: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  stat: { minWidth: 76, flexGrow: 1, backgroundColor: '#182231', borderRadius: 7, padding: 6 },
  statLabel: { color: '#738299', fontSize: 7, fontWeight: '900' },
  statValue: { color: '#e9eef6', fontSize: 9, fontWeight: '900', marginTop: 1 },
  effect: { color: '#c7d7e7', fontSize: 10, fontWeight: '800', lineHeight: 14 },
  description: { color: '#9cabbc', fontSize: 9, lineHeight: 14 },
  rangeHelp: { color: '#6f879a', fontSize: 8, lineHeight: 12 },
});
