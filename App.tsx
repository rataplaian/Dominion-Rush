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
  AiDifficulty,
  createGameConfig,
  createInitialState,
  DEFAULT_CONFIG,
  formatMana,
  GameState,
  getMatchRemainingMs,
  placeEntity,
  SKIRMISH_PRESETS,
  SkirmishPresetId,
  territoryCount,
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

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function App() {
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal');
  const [preset, setPreset] = useState<SkirmishPresetId>('balanced');
  const config = useMemo(() => createGameConfig(difficulty), [difficulty]);
  const [state, setState] = useState<GameState>(() => createInitialState(1337, createGameConfig('normal'), [...SKIRMISH_PRESETS.balanced.deck], [...SKIRMISH_PRESETS.balanced.deck]));
  const [selectedCardId, setSelectedCardId] = useState(() => createInitialState().players.player.cards.hand[0]);
  const [message, setMessage] = useState('Select one of the 4 cards in your hand, then deploy it on a blue cell.');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || state.winner) return undefined;
    const handle = setInterval(() => {
      setState((current) => tickGame(current, TICK_MS, config));
    }, TICK_MS);
    return () => clearInterval(handle);
  }, [paused, state.winner, config]);

  useEffect(() => {
    if (!state.players.player.cards.hand.includes(selectedCardId)) {
      setSelectedCardId(state.players.player.cards.hand[0]);
    }
  }, [state.players.player.cards.hand, selectedCardId]);

  const selected = UNIT_BY_ID[selectedCardId];
  const remaining = getMatchRemainingMs(state, config);
  const phaseLabel = state.phase === 'overtime' ? 'OVERTIME · 2× MANA' : state.phase === 'finished' ? 'FINISHED' : 'REGULATION';
  const recentEvents = useMemo(() => [...state.events].reverse().slice(0, 5), [state.events]);

  const handleCellPress = (row: number, col: number) => {
    const result = placeEntity(state, 'player', selectedCardId, row, col);
    if (!result.ok) {
      setMessage(result.reason ?? 'Cannot deploy there.');
      return;
    }
    setState(result.state);
    setMessage(`${selected.name} deployed. Next card drawn automatically.`);
  };

  const reset = (level: AiDifficulty = difficulty, nextPreset: SkirmishPresetId = preset) => {
    const nextConfig = createGameConfig(level);
    const deck = [...SKIRMISH_PRESETS[nextPreset].deck];
    const fresh = createInitialState(Date.now() | 0, nextConfig, deck, deck);
    setState(fresh);
    setSelectedCardId(fresh.players.player.cards.hand[0]);
    setPaused(false);
    setMessage(`New ${level} ${SKIRMISH_PRESETS[nextPreset].name} skirmish. Control territory, pressure lanes and destroy the enemy Core.`);
  };

  const changeDifficulty = (level: AiDifficulty) => {
    setDifficulty(level);
    reset(level, preset);
  };

  const changePreset = (nextPreset: SkirmishPresetId) => {
    setPreset(nextPreset);
    reset(difficulty, nextPreset);
  };

  const resultTitle =
    state.winner === 'player' ? 'VICTORY' :
    state.winner === 'enemy' ? 'DEFEAT' :
    state.winner === 'draw' ? 'DRAW' : '';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>SINGLE PLAYER · MVP 1.1</Text>
            <Text style={styles.title}>Dominion Rush</Text>
            <Text style={styles.subtitle}>Real-time grid tactics · 5 × 6 battlefield</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={() => reset()} style={styles.resetButton}>
            <Text style={styles.resetText}>NEW MATCH</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.difficultyRow}>
          {(['easy', 'normal', 'hard'] as AiDifficulty[]).map((level) => (
            <TouchableOpacity
              key={level}
              accessibilityRole="button"
              accessibilityState={{ selected: difficulty === level }}
              onPress={() => changeDifficulty(level)}
              style={[styles.difficultyButton, difficulty === level ? styles.difficultySelected : null]}
            >
              <Text style={[styles.difficultyText, difficulty === level ? styles.difficultyTextSelected : null]}>
                {level.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.presetSection}>
          <Text style={styles.presetLabel}>SKIRMISH DECK</Text>
          <View style={styles.presetRow}>
            {(Object.keys(SKIRMISH_PRESETS) as SkirmishPresetId[]).map((id) => (
              <TouchableOpacity
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected: preset === id }}
                onPress={() => changePreset(id)}
                style={[styles.presetButton, preset === id ? styles.presetSelected : null]}
              >
                <Text style={[styles.presetText, preset === id ? styles.presetTextSelected : null]}>
                  {SKIRMISH_PRESETS[id].name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.presetDescription}>{SKIRMISH_PRESETS[preset].description}</Text>
        </View>

        <View style={styles.phaseBanner}>
          <Text style={styles.phaseText}>{phaseLabel}</Text>
          <Text style={styles.phaseHint}>
            {difficulty.toUpperCase()} AI · {state.phase === 'overtime' ? '1 mana / sec' : '1 mana / 2 sec'}
          </Text>
        </View>

        <View style={styles.scoreRow}>
          <StatPill label="ENEMY CORE" value={`${Math.round(state.players.enemy.coreHp)} HP`} />
          <StatPill label="TIME" value={formatClock(remaining)} />
          <StatPill label="YOUR CORE" value={`${Math.round(state.players.player.coreHp)} HP`} />
        </View>

        <View style={styles.enemyManaRow}>
          <Text style={styles.enemyMana}>
            Territory {territoryCount(state, 'enemy')}–{territoryCount(state, 'player')} · Enemy mana {formatMana(state.players.enemy.mana)}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setPaused((value) => !value)} style={styles.pauseButton}>
            <Text style={styles.pauseText}>{paused ? '▶ PLAY' : 'Ⅱ PAUSE'}</Text>
          </TouchableOpacity>
        </View>

        <GameBoard state={state} selectedCardId={selectedCardId} onCellPress={handleCellPress} />

        {state.winner ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>{resultTitle}</Text>
            <Text style={styles.resultText}>
              {state.events[state.events.length - 1]?.text ?? 'Match finished.'}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => reset()} style={styles.playAgainButton}>
              <Text style={styles.playAgainText}>PLAY AGAIN</Text>
            </TouchableOpacity>
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
          <Text style={styles.manaHint}>
            Starts at 3 · maximum 10 · doubles only during overtime
          </Text>
        </View>

        <CardBar
          cardIds={state.players.player.cards.hand}
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
          Eight-card deck, four-card rotating hand. Units and structures stay on their cells. Attacks normally travel along the same column. Melee cannot normally deploy on the row closest to its Core. Advancing units conquer enemy cells except the protected final row. A fully breached lane creates one emergency reinforcement slot. Regulation lasts 3:00; equal Core HP triggers 1:00 overtime with double mana. Remaining ties are resolved by territory, then draw.
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
  resetText: { color: '#d8dfeb', fontSize: 9, fontWeight: '900' },
  presetSection: { gap: 6 },
  presetLabel: { color: '#9eacc3', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetButton: { flex: 1, borderWidth: 1, borderColor: '#303b50', borderRadius: 9, paddingVertical: 8, alignItems: 'center', backgroundColor: '#141b26' },
  presetSelected: { borderColor: '#c6a8ff', backgroundColor: '#2a2340' },
  presetText: { color: '#7f8da5', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  presetTextSelected: { color: '#f5efff' },
  presetDescription: { color: '#6f7e94', fontSize: 9 },
  difficultyRow: { flexDirection: 'row', gap: 8 },
  difficultyButton: { flex: 1, borderWidth: 1, borderColor: '#303b50', borderRadius: 9, paddingVertical: 8, alignItems: 'center', backgroundColor: '#141b26' },
  difficultySelected: { borderColor: '#6fb6df', backgroundColor: '#1d3143' },
  difficultyText: { color: '#7f8da5', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  difficultyTextSelected: { color: '#f6f8fc' },
  phaseBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#171e2a', borderRadius: 10, padding: 9 },
  phaseText: { color: '#f6f8fc', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  phaseHint: { color: '#9f8ac7', fontSize: 10, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, backgroundColor: '#171e2a', borderRadius: 12, padding: 9, borderWidth: 1, borderColor: '#273248' },
  statLabel: { color: '#77869b', fontSize: 8, fontWeight: '800' },
  statValue: { color: '#f6f8fc', fontSize: 12, fontWeight: '900', marginTop: 2 },
  enemyManaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  enemyMana: { color: '#c28da1', fontSize: 10, fontWeight: '700', flex: 1 },
  pauseButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#1b2230' },
  pauseText: { color: '#b9c4d4', fontSize: 9, fontWeight: '900' },
  resultBox: { backgroundColor: '#20283a', borderRadius: 14, borderWidth: 1, borderColor: '#596b89', padding: 16, alignItems: 'center', gap: 7 },
  resultTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  resultText: { color: '#aab6c8', fontSize: 12, textAlign: 'center' },
  playAgainButton: { marginTop: 4, backgroundColor: '#263c54', paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10 },
  playAgainText: { color: '#fff', fontSize: 10, fontWeight: '900' },
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
