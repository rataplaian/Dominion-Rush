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
  Entity,
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

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function attackSpeedLabel(ms: number, type: string): string {
  if (type === 'none') return '—';
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

function movementLabel(id: string): string {
  const unit = UNIT_BY_ID[id];
  if (!unit.advanceCooldownMs) return 'Static';
  return `1 cell / ${unit.advanceCooldownMs / 1000}s`;
}

export default function App() {
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal');
  const [playerPreset, setPlayerPreset] = useState<SkirmishPresetId>('balanced');
  const [enemyPreset, setEnemyPreset] = useState<SkirmishPresetId>('balanced');
  const config = useMemo(() => createGameConfig(difficulty), [difficulty]);

  const buildState = (
    level: AiDifficulty,
    playerDeckId: SkirmishPresetId,
    enemyDeckId: SkirmishPresetId,
  ) => createInitialState(
    Date.now() | 0,
    createGameConfig(level),
    [...SKIRMISH_PRESETS[playerDeckId].deck],
    [...SKIRMISH_PRESETS[enemyDeckId].deck],
  );

  const [state, setState] = useState<GameState>(() =>
    createInitialState(
      1337,
      createGameConfig('normal'),
      [...SKIRMISH_PRESETS.balanced.deck],
      [...SKIRMISH_PRESETS.balanced.deck],
    ),
  );
  const [selectedCardId, setSelectedCardId] = useState(() => state.players.player.cards.hand[0]);
  const [inspectedEntityId, setInspectedEntityId] = useState<number | null>(null);
  const [message, setMessage] = useState('Choose difficulty and decks, then press START MATCH.');
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!started || paused || state.winner) return undefined;
    const handle = setInterval(() => {
      setState((current) => tickGame(current, TICK_MS, config));
    }, TICK_MS);
    return () => clearInterval(handle);
  }, [started, paused, state.winner, config]);

  useEffect(() => {
    if (!state.players.player.cards.hand.includes(selectedCardId)) {
      setSelectedCardId(state.players.player.cards.hand[0]);
    }
  }, [state.players.player.cards.hand, selectedCardId]);

  useEffect(() => {
    if (inspectedEntityId !== null && !state.entities.some((entity) => entity.id === inspectedEntityId)) {
      setInspectedEntityId(null);
    }
  }, [state.entities, inspectedEntityId]);

  const selected = UNIT_BY_ID[selectedCardId];
  const inspectedEntity = inspectedEntityId === null
    ? null
    : state.entities.find((entity) => entity.id === inspectedEntityId) ?? null;
  const inspectedDefinition = inspectedEntity ? UNIT_BY_ID[inspectedEntity.definitionId] : selected;

  const remaining = getMatchRemainingMs(state, config);
  const phaseLabel = !started
    ? 'READY'
    : state.phase === 'overtime'
      ? 'OVERTIME · 2× MANA'
      : state.phase === 'finished'
        ? 'FINISHED'
        : paused
          ? 'PAUSED'
          : 'REGULATION';

  const recentEvents = useMemo(() => [...state.events].reverse().slice(0, 5), [state.events]);

  const prepareMatch = (
    level: AiDifficulty = difficulty,
    nextPlayerPreset: SkirmishPresetId = playerPreset,
    nextEnemyPreset: SkirmishPresetId = enemyPreset,
  ) => {
    const fresh = buildState(level, nextPlayerPreset, nextEnemyPreset);
    setState(fresh);
    setSelectedCardId(fresh.players.player.cards.hand[0]);
    setInspectedEntityId(null);
    setStarted(false);
    setPaused(false);
    setMessage('Setup ready. Press START MATCH when you are ready.');
  };

  const startMatch = () => {
    const fresh = buildState(difficulty, playerPreset, enemyPreset);
    setState(fresh);
    setSelectedCardId(fresh.players.player.cards.hand[0]);
    setInspectedEntityId(null);
    setPaused(false);
    setStarted(true);
    setMessage('Match started. Select a card, then tap a bright blue cell to deploy it.');
  };

  const handleCellPress = (row: number, col: number) => {
    if (!started || paused || state.winner) return;

    const result = placeEntity(state, 'player', selectedCardId, row, col);
    if (!result.ok) {
      setMessage(result.reason ?? 'Cannot deploy there.');
      return;
    }
    setState(result.state);
    setInspectedEntityId(null);
    setMessage(`${selected.name} deployed. The next card entered your hand.`);
  };

  const inspectEntity = (entity: Entity) => {
    setInspectedEntityId(entity.id);
    const unit = UNIT_BY_ID[entity.definitionId];
    setMessage(
      `${entity.owner === 'player' ? 'Your' : 'Enemy'} ${unit.name}: ${Math.round(entity.hp)}/${unit.maxHp} HP.`,
    );
  };

  const changeDifficulty = (level: AiDifficulty) => {
    setDifficulty(level);
    prepareMatch(level, playerPreset, enemyPreset);
  };

  const changePlayerPreset = (nextPreset: SkirmishPresetId) => {
    setPlayerPreset(nextPreset);
    prepareMatch(difficulty, nextPreset, enemyPreset);
  };

  const changeEnemyPreset = (nextPreset: SkirmishPresetId) => {
    setEnemyPreset(nextPreset);
    prepareMatch(difficulty, playerPreset, nextPreset);
  };

  const resultTitle =
    state.winner === 'player' ? 'VICTORY' :
    state.winner === 'enemy' ? 'DEFEAT' :
    state.winner === 'draw' ? 'DRAW' : '';

  const rangeText = inspectedDefinition.attackType === 'none'
    ? '—'
    : `${inspectedDefinition.range} cell${inspectedDefinition.range === 1 ? '' : 's'}`;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>SINGLE PLAYER · PLAYTEST 1.2</Text>
            <Text style={styles.title}>Dominion Rush</Text>
            <Text style={styles.subtitle}>Real-time grid tactics · 5 × 6 battlefield</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={() => prepareMatch()} style={styles.resetButton}>
            <Text style={styles.resetText}>NEW MATCH</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.setupPanel, started ? styles.setupLocked : null]}>
          <View style={styles.setupHeader}>
            <View>
              <Text style={styles.setupTitle}>{started ? 'MATCH SETUP' : 'BEFORE THE BATTLE'}</Text>
              <Text style={styles.setupSubtitle}>
                {started ? 'Setup is locked until you start a new match.' : 'Choose the match, inspect your opening hand, then start.'}
              </Text>
            </View>
          </View>

          <View style={styles.difficultyRow}>
            {(['easy', 'normal', 'hard'] as AiDifficulty[]).map((level) => (
              <TouchableOpacity
                key={level}
                accessibilityRole="button"
                accessibilityState={{ selected: difficulty === level, disabled: started }}
                disabled={started}
                onPress={() => changeDifficulty(level)}
                style={[styles.difficultyButton, difficulty === level ? styles.difficultySelected : null]}
              >
                <Text style={[styles.difficultyText, difficulty === level ? styles.difficultyTextSelected : null]}>
                  {level.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.presetLabel}>YOUR DECK</Text>
          <View style={styles.presetRow}>
            {(Object.keys(SKIRMISH_PRESETS) as SkirmishPresetId[]).map((id) => (
              <TouchableOpacity
                key={`player-${id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: playerPreset === id, disabled: started }}
                disabled={started}
                onPress={() => changePlayerPreset(id)}
                style={[styles.presetButton, playerPreset === id ? styles.presetSelected : null]}
              >
                <Text style={[styles.presetText, playerPreset === id ? styles.presetTextSelected : null]}>
                  {SKIRMISH_PRESETS[id].name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.presetDescription}>{SKIRMISH_PRESETS[playerPreset].description}</Text>

          <Text style={[styles.presetLabel, styles.enemyPresetLabel]}>ENEMY DECK</Text>
          <View style={styles.presetRow}>
            {(Object.keys(SKIRMISH_PRESETS) as SkirmishPresetId[]).map((id) => (
              <TouchableOpacity
                key={`enemy-${id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: enemyPreset === id, disabled: started }}
                disabled={started}
                onPress={() => changeEnemyPreset(id)}
                style={[styles.presetButton, enemyPreset === id ? styles.enemyPresetSelected : null]}
              >
                <Text style={[styles.presetText, enemyPreset === id ? styles.presetTextSelected : null]}>
                  {SKIRMISH_PRESETS[id].name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.presetDescription}>{SKIRMISH_PRESETS[enemyPreset].description}</Text>

          {!started ? (
            <TouchableOpacity accessibilityRole="button" onPress={startMatch} style={styles.startButton}>
              <Text style={styles.startButtonText}>▶ START MATCH</Text>
              <Text style={styles.startButtonHint}>Timer and enemy AI start only after this button.</Text>
            </TouchableOpacity>
          ) : null}
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
          {started ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setPaused((value) => !value)}
              style={styles.pauseButton}
              disabled={Boolean(state.winner)}
            >
              <Text style={styles.pauseText}>{paused ? '▶ PLAY' : 'Ⅱ PAUSE'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!started ? (
          <View style={styles.readyNotice}>
            <Text style={styles.readyTitle}>THE BATTLE HAS NOT STARTED</Text>
            <Text style={styles.readyText}>
              The board is frozen. You can inspect your hand below before pressing START MATCH.
            </Text>
          </View>
        ) : null}

        <GameBoard
          state={state}
          selectedCardId={selectedCardId}
          onCellPress={handleCellPress}
          onEntityPress={inspectEntity}
          interactionEnabled={started && !paused && !Boolean(state.winner)}
        />

        {state.winner ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>{resultTitle}</Text>
            <Text style={styles.resultText}>
              {state.events[state.events.length - 1]?.text ?? 'Match finished.'}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => prepareMatch()} style={styles.playAgainButton}>
              <Text style={styles.playAgainText}>SET UP NEXT MATCH</Text>
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
          <Text style={styles.manaHint}>Starts at 3 · maximum 10 · doubles only during overtime</Text>
        </View>

        <CardBar
          cardIds={state.players.player.cards.hand}
          mana={state.players.player.mana}
          selectedCardId={selectedCardId}
          onSelect={(id) => {
            setSelectedCardId(id);
            setInspectedEntityId(null);
            setMessage(UNIT_BY_ID[id].description);
          }}
        />

        <View style={styles.unitInfoPanel}>
          <View style={styles.unitInfoHeader}>
            <Text style={styles.unitInfoIcon}>{inspectedDefinition.icon}</Text>
            <View style={styles.unitInfoTitleWrap}>
              <Text style={styles.unitInfoName}>
                {inspectedEntity ? `${inspectedEntity.owner === 'player' ? 'YOUR' : 'ENEMY'} ` : ''}
                {inspectedDefinition.name.toUpperCase()}
              </Text>
              <Text style={styles.unitInfoRole}>
                {inspectedDefinition.kind.toUpperCase()} · {inspectedDefinition.attackType.toUpperCase()}
              </Text>
            </View>
            {!inspectedEntity ? <Text style={styles.unitMana}>{inspectedDefinition.manaCost} ◈</Text> : null}
          </View>

          <View style={styles.detailGrid}>
            <DetailPill
              label="HP"
              value={inspectedEntity ? `${Math.round(inspectedEntity.hp)} / ${inspectedDefinition.maxHp}` : String(inspectedDefinition.maxHp)}
            />
            <DetailPill label="DAMAGE" value={inspectedDefinition.attackType === 'none' ? '—' : String(inspectedDefinition.attackDamage)} />
            <DetailPill label="RANGE" value={rangeText} />
            <DetailPill label="ATTACK CD" value={attackSpeedLabel(inspectedDefinition.attackCooldownMs, inspectedDefinition.attackType)} />
            <DetailPill label="MOVEMENT" value={movementLabel(inspectedDefinition.id)} />
            <DetailPill
              label="SPECIAL"
              value={
                inspectedDefinition.chargeBonus
                  ? `Charge +${Math.round(inspectedDefinition.chargeBonus * 100)}%`
                  : inspectedDefinition.splashFactor
                    ? `Splash ${Math.round(inspectedDefinition.splashFactor * 100)}%`
                    : 'None'
              }
            />
          </View>

          <Text style={styles.unitDescription}>{inspectedDefinition.description}</Text>
          <Text style={styles.rangeHelp}>
            RANGE is measured in grid cells forward in the same lane. Example: RANGE 4 can hit up to four cells ahead, but not sideways unless the unit has a special splash effect.
          </Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        <View style={styles.logPanel}>
          <Text style={styles.logTitle}>BATTLE LOG</Text>
          {recentEvents.length === 0 ? <Text style={styles.logEmpty}>No combat events yet.</Text> : null}
          {recentEvents.map((event) => (
            <Text key={event.id} style={styles.logLine}>• {event.text}</Text>
          ))}
        </View>

        <Text style={styles.rules}>
          Eight-card deck, four-card rotating hand. Tap a card to read its exact stats. Tap any deployed unit to inspect it. Units attack automatically when a valid target enters their forward range. Advancing units conquer enemy cells except the protected final row.
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

  setupPanel: { backgroundColor: '#121925', borderWidth: 1, borderColor: '#2a3548', borderRadius: 14, padding: 12, gap: 7 },
  setupLocked: { opacity: 0.72 },
  setupHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  setupTitle: { color: '#f3f6fb', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  setupSubtitle: { color: '#74839a', fontSize: 9, marginTop: 2 },
  presetLabel: { color: '#9eacc3', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetButton: { flex: 1, borderWidth: 1, borderColor: '#303b50', borderRadius: 9, paddingVertical: 8, alignItems: 'center', backgroundColor: '#141b26' },
  presetSelected: { borderColor: '#6fb6df', backgroundColor: '#1d3143' },
  enemyPresetSelected: { borderColor: '#d48aa3', backgroundColor: '#38202a' },
  presetText: { color: '#7f8da5', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  presetTextSelected: { color: '#f5efff' },
  presetDescription: { color: '#6f7e94', fontSize: 9 },
  enemyPresetLabel: { marginTop: 4 },
  difficultyRow: { flexDirection: 'row', gap: 8 },
  difficultyButton: { flex: 1, borderWidth: 1, borderColor: '#303b50', borderRadius: 9, paddingVertical: 8, alignItems: 'center', backgroundColor: '#141b26' },
  difficultySelected: { borderColor: '#6fb6df', backgroundColor: '#1d3143' },
  difficultyText: { color: '#7f8da5', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  difficultyTextSelected: { color: '#f6f8fc' },
  startButton: { marginTop: 7, backgroundColor: '#2e6f52', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center' },
  startButtonText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  startButtonHint: { color: '#c8e3d5', fontSize: 9, marginTop: 3 },

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

  readyNotice: { backgroundColor: '#193143', borderWidth: 1, borderColor: '#3d6b87', borderRadius: 12, padding: 11 },
  readyTitle: { color: '#d8effc', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  readyText: { color: '#93b5c9', fontSize: 10, marginTop: 3 },

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

  unitInfoPanel: { backgroundColor: '#141b26', borderRadius: 14, padding: 12, gap: 9, borderWidth: 1, borderColor: '#273248' },
  unitInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  unitInfoIcon: { fontSize: 28 },
  unitInfoTitleWrap: { flex: 1 },
  unitInfoName: { color: '#f5f8fc', fontSize: 13, fontWeight: '900' },
  unitInfoRole: { color: '#7f8da5', fontSize: 9, fontWeight: '800', marginTop: 2 },
  unitMana: { color: '#c6a8ff', fontSize: 15, fontWeight: '900' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailPill: { width: '31%', minWidth: 90, backgroundColor: '#1a2331', borderRadius: 9, padding: 7 },
  detailLabel: { color: '#738299', fontSize: 7, fontWeight: '900' },
  detailValue: { color: '#e9eef6', fontSize: 10, fontWeight: '900', marginTop: 2 },
  unitDescription: { color: '#b5c0d0', fontSize: 10, lineHeight: 15 },
  rangeHelp: { color: '#7892a7', fontSize: 9, lineHeight: 14 },
  message: { color: '#edf2f8', fontSize: 10, fontWeight: '700' },

  logPanel: { borderTopWidth: 1, borderTopColor: '#252f42', paddingTop: 10, gap: 4 },
  logTitle: { color: '#9eacc3', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  logEmpty: { color: '#667489', fontSize: 10 },
  logLine: { color: '#9aa8bc', fontSize: 10 },
  rules: { color: '#617087', fontSize: 10, lineHeight: 15 },
});
