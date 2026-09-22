import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CardBar } from './src/components/CardBar';
import { GameBoard } from './src/components/GameBoard';
import {
  createInitialState,
  DEFAULT_CONFIG,
  formatMana,
  GameState,
  placeEntity,
  STARTER_DECK,
  tickGame,
  UNIT_BY_ID,
} from './src/game';

const TICK_MS = 100;

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [selectedCardId, setSelectedCardId] = useState(STARTER_DECK[0]);
  const [message, setMessage] = useState('Select a card, then deploy it on a blue cell. Territory can change during battle.');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || state.winner) return undefined;
    const handle = setInterval(() => {
      setState((current) => tickGame(current, TICK_MS));
    }, TICK_MS);
    return () => clearInterval(handle);
  }, [paused, state.winner]);

  const selected = UNIT_BY_ID[selectedCardId];
  const seconds = Math.floor(state.timeMs / 1000);
  const timeLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const recentEvents = useMemo(() => [...state.events].reverse().slice(0, 4), [state.events]);

  const handleCellPress = (row: number, col: number) => {
    const result = placeEntity(state, 'player', selectedCardId, row, col);
    if (!result.ok) {
      setMessage(result.reason ?? 'Cannot deploy there.');
      return;
    }
    setState(result.state);
    setMessage(`${selected.name} deployed.`);
  };

  const reset = () => {
    setState(createInitialState(Date.now() | 0));
    setSelectedCardId(STARTER_DECK[0]);
    setPaused(false);
    setMessage('New match. Blue cells are yours; advancing units can conquer enemy territory.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>PROTOTYPE 0.2</Text>
            <Text style={styles.title}>Dominion Rush</Text>
            <Text style={styles.subtitle}>Real-time lane tactics on a 5 × 6 grid</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={reset} style={styles.resetButton}>
            <Text style={styles.resetText}>RESET</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scoreRow}>
          <StatPill label="ENEMY CORE" value={`${Math.round(state.players.enemy.coreHp)} HP`} />
          <StatPill label="TIME" value={timeLabel} />
          <StatPill label="YOUR CORE" value={`${Math.round(state.players.player.coreHp)} HP`} />
        </View>

        <View style={styles.enemyManaRow}>
          <Text style={styles.enemyMana}>Enemy mana: {formatMana(state.players.enemy.mana)} / {DEFAULT_CONFIG.maxMana}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setPaused((value) => !value)} style={styles.pauseButton}>
            <Text style={styles.pauseText}>{paused ? '▶ PLAY' : 'Ⅱ PAUSE'}</Text>
          </TouchableOpacity>
        </View>

        <GameBoard state={state} selectedCardId={selectedCardId} onCellPress={handleCellPress} />

        {state.winner ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>{state.winner === 'player' ? 'VICTORY' : 'DEFEAT'}</Text>
            <Text style={styles.resultText}>{state.winner === 'player' ? 'You destroyed the enemy Core.' : 'The enemy destroyed your Core.'}</Text>
          </View>
        ) : null}

        <View style={styles.manaPanel}>
          <View style={styles.manaHeader}>
            <Text style={styles.manaTitle}>MANA</Text>
            <Text style={styles.manaNumber}>{formatMana(state.players.player.mana)} / {DEFAULT_CONFIG.maxMana}</Text>
          </View>
          <View style={styles.manaTrack}>
            <View style={[styles.manaFill, { width: `${(state.players.player.mana / DEFAULT_CONFIG.maxMana) * 100}%` }]} />
          </View>
          <Text style={styles.manaHint}>Starts at 3 · regenerates 1 mana every 2 seconds</Text>
        </View>

        <CardBar
          mana={state.players.player.mana}
          selectedCardId={selectedCardId}
          onSelect={(id) => {
            setSelectedCardId(id);
            setMessage(UNIT_BY_ID[id].description);
          }}
        />

        <View style={styles.infoPanel}>
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.selectedDescription}>
            Selected: {selected.icon} {selected.name} · {selected.manaCost} mana · {selected.description}
          </Text>
        </View>

        <View style={styles.logPanel}>
          <Text style={styles.logTitle}>BATTLE LOG</Text>
          {recentEvents.length === 0 ? <Text style={styles.logEmpty}>No combat events yet.</Text> : null}
          {recentEvents.map((event) => (
            <Text key={event.id} style={styles.logLine}>• {event.text}</Text>
          ))}
        </View>

        <Text style={styles.rules}>
          Attacks normally travel only along the same column. Melee fights from the front and cannot normally be deployed on the row nearest your Core; ranged units can use any controlled cell. Units marked ↑ advance on cooldown and permanently capture enemy cells they enter, except the defender's protected final row. Losing both conquerable cells of a lane opens a temporary emergency reinforcement cell behind that lane. Territory currently does not modify mana generation.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d1119' },
  page: { padding: 16, gap: 14, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  headerTextWrap: { flex: 1 },
  eyebrow: { color: '#6fb6df', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#f7f9fc', fontSize: 26, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#8593a9', fontSize: 12, marginTop: 2 },
  resetButton: { borderWidth: 1, borderColor: '#39465c', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  resetText: { color: '#d8dfeb', fontSize: 10, fontWeight: '900' },
  scoreRow: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, backgroundColor: '#171e2a', borderRadius: 12, padding: 9, borderWidth: 1, borderColor: '#273248' },
  statLabel: { color: '#77869b', fontSize: 8, fontWeight: '800' },
  statValue: { color: '#f6f8fc', fontSize: 12, fontWeight: '900', marginTop: 2 },
  enemyManaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enemyMana: { color: '#c28da1', fontSize: 11, fontWeight: '700' },
  pauseButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#1b2230' },
  pauseText: { color: '#b9c4d4', fontSize: 9, fontWeight: '900' },
  resultBox: { backgroundColor: '#20283a', borderRadius: 14, borderWidth: 1, borderColor: '#596b89', padding: 16, alignItems: 'center' },
  resultTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  resultText: { color: '#aab6c8', fontSize: 12, marginTop: 4 },
  manaPanel: { gap: 6 },
  manaHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  manaTitle: { color: '#9eacc3', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  manaNumber: { color: '#c6a8ff', fontSize: 13, fontWeight: '900' },
  manaTrack: { height: 9, backgroundColor: '#25213a', borderRadius: 99, overflow: 'hidden' },
  manaFill: { height: '100%', backgroundColor: '#9f7aea' },
  manaHint: { color: '#69768a', fontSize: 10 },
  infoPanel: { backgroundColor: '#141b26', borderRadius: 12, padding: 12, gap: 5 },
  message: { color: '#edf2f8', fontSize: 12, fontWeight: '700' },
  selectedDescription: { color: '#8997aa', fontSize: 10, lineHeight: 15 },
  logPanel: { borderTopWidth: 1, borderTopColor: '#252f42', paddingTop: 10, gap: 4 },
  logTitle: { color: '#9eacc3', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  logEmpty: { color: '#667489', fontSize: 10 },
  logLine: { color: '#9aa8bc', fontSize: 10 },
  rules: { color: '#617087', fontSize: 10, lineHeight: 15 },
});
