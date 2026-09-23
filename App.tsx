import React, { useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CardBar } from './src/components/CardBar';
import { DeckLibrary } from './src/components/DeckLibrary';
import { GameBoard } from './src/components/GameBoard';
import {
  AiDifficulty,
  claimPlayerHalfCell,
  createGameConfig,
  createInitialState,
  DEFAULT_CONFIG,
  Entity,
  formatMana,
  GameState,
  getMatchRemainingMs,
  manualAdvanceEntity,
  placeEntity,
  SKIRMISH_PRESETS,
  SkirmishPresetId,
  territoryCount,
  tickGame,
  UNIT_BY_ID,
} from './src/game';

const TICK_MS = 100;
const MENU_BG = require('./assets/menu-bg.webp');
const SETUP_BG = require('./assets/setup-bg.webp');

function BackgroundShell({
  source,
  children,
  dense = false,
}: {
  source: any;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <ImageBackground source={source} resizeMode="cover" style={styles.screenBackground}>
      <View style={[styles.backgroundScrim, dense ? styles.backgroundScrimDense : null]}>
        {children}
      </View>
    </ImageBackground>
  );
}

type AppScreen = 'menu' | 'setup' | 'game' | 'settings';
type SettingsSection = 'glossary' | 'info' | 'rules';

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
  return `Free move / ${unit.advanceCooldownMs / 1000}s`;
}

function BackButton({ onPress, label = '← BACK' }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.backButton}>
      <Text style={styles.backText}>{label}</Text>
    </TouchableOpacity>
  );
}

function MainMenu({
  onPlay,
  onSettings,
}: {
  onPlay: () => void;
  onSettings: () => void;
}) {
  return (
    <View style={styles.menuPage}>
      <View style={styles.menuHero}>
        <Text style={styles.menuEyebrow}>REAL-TIME GRID TACTICS</Text>
        <Text style={styles.menuTitle}>Dominion Rush</Text>
        <Text style={styles.menuSubtitle}>
          Conquista il centro, controlla il territorio e distruggi il Core avversario.
        </Text>
      </View>

      <View style={styles.menuButtons}>
        <TouchableOpacity accessibilityRole="button" onPress={onPlay} style={styles.primaryMenuButton}>
          <Text style={styles.primaryMenuIcon}>⚔️</Text>
          <View style={styles.menuButtonTextWrap}>
            <Text style={styles.primaryMenuText}>GIOCA</Text>
            <Text style={styles.primaryMenuHint}>Scegli mazzo e difficoltà, poi entra in battaglia</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" onPress={onSettings} style={styles.secondaryMenuButton}>
          <Text style={styles.primaryMenuIcon}>⚙️</Text>
          <View style={styles.menuButtonTextWrap}>
            <Text style={styles.secondaryMenuText}>IMPOSTAZIONI</Text>
            <Text style={styles.secondaryMenuHint}>Glossario, informazioni e regole di gioco</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>PLAYTEST 1.4</Text>
    </View>
  );
}

const GLOSSARY = [
  ['Mana', 'Risorsa usata per giocare carte e, in alcune zone, reclamare territorio. Parte da 3 e arriva a 10.'],
  ['Mano', 'Hai 4 carte visibili. Quando ne giochi una, entra automaticamente la carta successiva del mazzo.'],
  ['Range', 'Numero massimo di caselle davanti nella stessa colonna che un attacco può raggiungere.'],
  ['Movement Charge', 'Barra laterale della pedina. Quando è piena e la freccia ↑ si illumina, puoi avanzare di 1 casella gratis.'],
  ['Territorio neutrale', 'Le due file centrali partono neutrali. Non puoi schierarci finché non vengono conquistate avanzando.'],
  ['Core', 'La base di ogni giocatore. Se il tuo Core arriva a 0 HP perdi immediatamente.'],
  ['Protected Row', 'La fila più vicina al Core non cambia proprietario anche se viene occupata da un invasore.'],
  ['Respinta difensiva', 'Se un invasore occupa esattamente una casella della tua fila protetta, puoi schierare una tua unità in quella stessa casella: l’invasore viene spinto indietro di 1 casella se quella precedente è libera.'],
  ['Charge', 'Bonus applicato ad alcune unità dopo un avanzamento manuale riuscito.'],
  ['Splash', 'Parte del danno colpisce anche nemici nelle colonne adiacenti al bersaglio principale.'],
  ['Overtime', 'Se a 3:00 i Core hanno gli stessi HP, parte 1 minuto supplementare con rigenerazione mana doppia.'],
] as const;

function SettingsScreen({
  section,
  setSection,
  onBack,
}: {
  section: SettingsSection;
  setSection: (value: SettingsSection) => void;
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.screenHeader}>
        <BackButton onPress={onBack} />
        <View style={styles.screenHeaderText}>
          <Text style={styles.screenEyebrow}>DOMINION RUSH</Text>
          <Text style={styles.screenTitle}>Impostazioni</Text>
        </View>
      </View>

      <View style={styles.settingsTabs}>
        {([
          ['glossary', 'GLOSSARIO'],
          ['info', 'INFO'],
          ['rules', 'REGOLE'],
        ] as [SettingsSection, string][]).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: section === id }}
            onPress={() => setSection(id)}
            style={[styles.settingsTab, section === id ? styles.settingsTabActive : null]}
          >
            <Text style={[styles.settingsTabText, section === id ? styles.settingsTabTextActive : null]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {section === 'glossary' ? (
        <View style={styles.settingsContent}>
          <Text style={styles.sectionHeading}>Glossario</Text>
          <Text style={styles.sectionIntro}>I termini principali usati durante una partita.</Text>
          {GLOSSARY.map(([term, description]) => (
            <View key={term} style={styles.glossaryItem}>
              <Text style={styles.glossaryTerm}>{term}</Text>
              <Text style={styles.glossaryDescription}>{description}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {section === 'info' ? (
        <View style={styles.settingsContent}>
          <Text style={styles.sectionHeading}>Info</Text>
          <Text style={styles.sectionIntro}>
            Dominion Rush è un gioco tattico in tempo reale su griglia 5×6. La posizione delle unità,
            il timing delle carte e la conquista del terreno contano più del movimento continuo.
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>VERSIONE</Text>
            <Text style={styles.infoValue}>Playtest 1.4</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>MODALITÀ ATTUALE</Text>
            <Text style={styles.infoValue}>Single Player vs AI</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>CAMPO</Text>
            <Text style={styles.infoValue}>5 colonne × 6 file</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>DURATA</Text>
            <Text style={styles.infoValue}>3:00 + eventuale overtime 1:00</Text>
          </View>
        </View>
      ) : null}

      {section === 'rules' ? (
        <View style={styles.settingsContent}>
          <Text style={styles.sectionHeading}>Regole principali</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.ruleNumber}>01</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Obiettivo</Text>
              <Text style={styles.ruleBody}>Distruggi il Core nemico oppure termina il tempo con più HP del Core.</Text>
            </View>
          </View>
          <View style={styles.ruleCard}>
            <Text style={styles.ruleNumber}>02</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Schieramento</Text>
              <Text style={styles.ruleBody}>Puoi piazzare carte solo nelle caselle che controlli. Le due file centrali sono inizialmente neutrali.</Text>
            </View>
          </View>
          <View style={styles.ruleCard}>
            <Text style={styles.ruleNumber}>03</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Combattimento</Text>
              <Text style={styles.ruleBody}>Gli attacchi sono automatici quando esiste un bersaglio valido nel range e nella stessa corsia.</Text>
            </View>
          </View>
          <View style={styles.ruleCard}>
            <Text style={styles.ruleNumber}>04</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Movimento</Text>
              <Text style={styles.ruleBody}>Quasi tutte le unità caricano una freccia movimento. Quando è pronta, tocca la pedina per avanzare di 1 gratis.</Text>
            </View>
          </View>
          <View style={styles.ruleCard}>
            <Text style={styles.ruleNumber}>05</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Conquista</Text>
              <Text style={styles.ruleBody}>Entrare in una casella neutrale o nemica conquistabile ne cambia il controllo. La fila protetta del Core non cambia proprietario.</Text>
            </View>
          </View>
          <View style={styles.ruleCard}>
            <Text style={styles.ruleNumber}>06</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Respinta sulla fila protetta</Text>
              <Text style={styles.ruleBody}>Se un nemico raggiunge l’ultima casella davanti al tuo Core, puoi giocare una tua unità direttamente su quella casella. L’invasore arretra di 1 casella, purché la casella precedente sia libera.</Text>
            </View>
          </View>
          <View style={styles.ruleCard}>
            <Text style={styles.ruleNumber}>07</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Overtime</Text>
              <Text style={styles.ruleBody}>A parità di HP dopo 3 minuti parte 1 minuto con mana doppio. Poi decide HP, territorio e infine pareggio.</Text>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('glossary');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal');
  const [playerPreset, setPlayerPreset] = useState<SkirmishPresetId>('balanced');
  const [libraryUnitId, setLibraryUnitId] = useState<string>(SKIRMISH_PRESETS.balanced.deck[0]);
  const config = useMemo(() => createGameConfig(difficulty), [difficulty]);

  const buildState = () => createInitialState(
    Date.now() | 0,
    config,
    [...SKIRMISH_PRESETS[playerPreset].deck],
    [...SKIRMISH_PRESETS.balanced.deck],
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
  const [message, setMessage] = useState('Select a card, then deploy it on your territory.');
  const [paused, setPaused] = useState(false);

  const inGame = screen === 'game';

  useEffect(() => {
    if (!inGame || paused || state.winner) return undefined;
    const handle = setInterval(() => {
      setState((current) => tickGame(current, TICK_MS, config));
    }, TICK_MS);
    return () => clearInterval(handle);
  }, [inGame, paused, state.winner, config]);

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
  const recentEvents = useMemo(() => [...state.events].reverse().slice(0, 5), [state.events]);

  const openSetup = () => {
    setLibraryUnitId(SKIRMISH_PRESETS[playerPreset].deck[0]);
    setScreen('setup');
  };

  const startMatch = () => {
    const fresh = buildState();
    setState(fresh);
    setSelectedCardId(fresh.players.player.cards.hand[0]);
    setInspectedEntityId(null);
    setPaused(false);
    setMessage('Match started. Select a card, then tap a bright blue cell to deploy it.');
    setScreen('game');
  };

  const leaveGame = () => {
    setPaused(false);
    setInspectedEntityId(null);
    setScreen('menu');
  };

  const handleCellPress = (row: number, col: number) => {
    if (paused || state.winner) return;

    const isPlayerHalf = row >= 3;
    const isUnownedPlayerHalfCell = isPlayerHalf && state.territory[row]?.[col] !== 'player';

    if (isUnownedPlayerHalfCell) {
      const claim = claimPlayerHalfCell(state, row, col);
      if (!claim.ok) {
        setMessage(claim.reason ?? 'Cannot claim that cell.');
        return;
      }

      const spent = state.players.player.mana - claim.state.players.player.mana;
      setState(claim.state);
      setInspectedEntityId(null);
      setMessage(`Territory claimed for ${spent.toFixed(0)} mana.`);
      return;
    }

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

  const handleEntityPress = (entity: Entity) => {
    if (!paused && !state.winner && entity.owner === 'player') {
      const definition = UNIT_BY_ID[entity.definitionId];

      if (definition.kind === 'unit' && definition.advanceCooldownMs && entity.moveReadyAt !== null) {
        const ready = state.timeMs >= entity.moveReadyAt;
        if (ready) {
          const result = manualAdvanceEntity(state, 'player', entity.id);
          if (result.ok) {
            setState(result.state);
            setInspectedEntityId(null);
            setMessage(`${definition.name} advanced one cell for free. Movement is recharging.`);
            return;
          }

          setInspectedEntityId(entity.id);
          setMessage(result.reason ?? 'This unit cannot advance right now.');
          return;
        }
      }
    }

    inspectEntity(entity);
  };

  if (screen === 'menu') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <BackgroundShell source={MENU_BG}>
          <MainMenu onPlay={openSetup} onSettings={() => setScreen('settings')} />
        </BackgroundShell>
      </SafeAreaView>
    );
  }

  if (screen === 'settings') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <BackgroundShell source={SETUP_BG} dense>
          <SettingsScreen
            section={settingsSection}
            setSection={setSettingsSection}
            onBack={() => setScreen('menu')}
          />
        </BackgroundShell>
      </SafeAreaView>
    );
  }

  if (screen === 'setup') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <BackgroundShell source={SETUP_BG} dense>
          <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.screenHeader}>
            <BackButton onPress={() => setScreen('menu')} />
            <View style={styles.screenHeaderText}>
              <Text style={styles.screenEyebrow}>GIOCA</Text>
              <Text style={styles.screenTitle}>Prepara la partita</Text>
            </View>
          </View>

          <View style={styles.setupPanel}>
            <Text style={styles.setupTitle}>DIFFICOLTÀ</Text>
            <View style={styles.difficultyRow}>
              {(['easy', 'normal', 'hard'] as AiDifficulty[]).map((level) => (
                <TouchableOpacity
                  key={level}
                  accessibilityRole="button"
                  accessibilityState={{ selected: difficulty === level }}
                  onPress={() => setDifficulty(level)}
                  style={[styles.difficultyButton, difficulty === level ? styles.difficultySelected : null]}
                >
                  <Text style={[styles.difficultyText, difficulty === level ? styles.difficultyTextSelected : null]}>
                    {level === 'easy' ? 'FACILE' : level === 'normal' ? 'NORMALE' : 'DIFFICILE'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.setupTitle, styles.setupTitleSpacing]}>MAZZO</Text>
            <View style={styles.presetRow}>
              {(Object.keys(SKIRMISH_PRESETS) as SkirmishPresetId[]).map((id) => (
                <TouchableOpacity
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: playerPreset === id }}
                  onPress={() => {
                    setPlayerPreset(id);
                    setLibraryUnitId(SKIRMISH_PRESETS[id].deck[0]);
                  }}
                  style={[styles.presetButton, playerPreset === id ? styles.presetSelected : null]}
                >
                  <Text style={[styles.presetText, playerPreset === id ? styles.presetTextSelected : null]}>
                    {SKIRMISH_PRESETS[id].name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.presetDescription}>{SKIRMISH_PRESETS[playerPreset].description}</Text>

            <DeckLibrary
              deckIds={SKIRMISH_PRESETS[playerPreset].deck}
              selectedId={libraryUnitId}
              onSelect={setLibraryUnitId}
            />

            <TouchableOpacity accessibilityRole="button" onPress={startMatch} style={styles.startButton}>
              <Text style={styles.startButtonText}>▶ PLAY</Text>
              <Text style={styles.startButtonHint}>La partita inizia solo dopo questo pulsante.</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </BackgroundShell>
      </SafeAreaView>
    );
  }

  const phaseLabel =
    state.phase === 'overtime'
      ? 'OVERTIME · 2× MANA'
      : state.phase === 'finished'
        ? 'FINISHED'
        : paused
          ? 'PAUSED'
          : 'REGULATION';

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
      <BackgroundShell source={SETUP_BG} dense>
        <ScrollView contentContainerStyle={styles.gamePage}>
        <View style={styles.gameHeader}>
          <TouchableOpacity accessibilityRole="button" onPress={leaveGame} style={styles.smallMenuButton}>
            <Text style={styles.smallMenuButtonText}>☰ MENU</Text>
          </TouchableOpacity>
          <View style={styles.gameTitleWrap}>
            <Text style={styles.gameTitle}>Dominion Rush</Text>
            <Text style={styles.gameSubTitle}>{difficulty.toUpperCase()} AI · {SKIRMISH_PRESETS[playerPreset].name}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPaused((value) => !value)}
            style={styles.smallMenuButton}
            disabled={Boolean(state.winner)}
          >
            <Text style={styles.smallMenuButtonText}>{paused ? '▶' : 'Ⅱ'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.phaseBanner}>
          <Text style={styles.phaseText}>{phaseLabel}</Text>
          <Text style={styles.phaseHint}>{state.phase === 'overtime' ? '1 mana / sec' : '1 mana / 2 sec'}</Text>
        </View>

        <View style={styles.scoreRow}>
          <StatPill label="ENEMY CORE" value={`${Math.round(state.players.enemy.coreHp)} HP`} />
          <StatPill label="TIME" value={formatClock(remaining)} />
          <StatPill label="YOUR CORE" value={`${Math.round(state.players.player.coreHp)} HP`} />
        </View>

        <Text style={styles.enemyMana}>
          Territory {territoryCount(state, 'enemy')}–{territoryCount(state, 'player')} · Enemy mana {formatMana(state.players.enemy.mana)}
        </Text>

        <GameBoard
          state={state}
          selectedCardId={selectedCardId}
          onCellPress={handleCellPress}
          onEntityPress={handleEntityPress}
          interactionEnabled={!paused && !Boolean(state.winner)}
        />

        {state.winner ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>{resultTitle}</Text>
            <Text style={styles.resultText}>{state.events[state.events.length - 1]?.text ?? 'Match finished.'}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => setScreen('setup')} style={styles.playAgainButton}>
              <Text style={styles.playAgainText}>NUOVA PARTITA</Text>
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
          <Text style={styles.message}>{message}</Text>
        </View>

        <View style={styles.logPanel}>
          <Text style={styles.logTitle}>BATTLE LOG</Text>
          {recentEvents.length === 0 ? <Text style={styles.logEmpty}>No combat events yet.</Text> : null}
          {recentEvents.map((event) => (
            <Text key={event.id} style={styles.logLine}>• {event.text}</Text>
          ))}
        </View>
        </ScrollView>
      </BackgroundShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d1119' },
  screenBackground: { flex: 1 },
  backgroundScrim: { flex: 1, backgroundColor: 'rgba(5, 10, 18, 0.28)' },
  backgroundScrimDense: { backgroundColor: 'rgba(5, 10, 18, 0.54)' },
  page: { padding: 16, gap: 14, paddingBottom: 40 },
  gamePage: { padding: 12, gap: 12, paddingBottom: 32 },

  menuPage: { flex: 1, padding: 22, justifyContent: 'space-between' },
  menuHero: { marginTop: 44, gap: 8 },
  menuEyebrow: { color: '#6fb6df', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  menuTitle: { color: '#f7f9fc', fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  menuSubtitle: { color: '#8695aa', fontSize: 14, lineHeight: 21, maxWidth: 440 },
  menuButtons: { gap: 12 },
  primaryMenuButton: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(31, 111, 76, 0.94)', borderRadius: 16, padding: 16 },
  secondaryMenuButton: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(23, 30, 42, 0.90)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2c384b' },
  primaryMenuIcon: { fontSize: 27 },
  menuButtonTextWrap: { flex: 1 },
  primaryMenuText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  primaryMenuHint: { color: '#c8ded4', fontSize: 10, marginTop: 3 },
  secondaryMenuText: { color: '#edf2f8', fontSize: 15, fontWeight: '900', letterSpacing: 0.7 },
  secondaryMenuHint: { color: '#8492a7', fontSize: 10, marginTop: 3 },
  versionText: { color: '#536174', fontSize: 9, fontWeight: '800', textAlign: 'center', marginBottom: 8 },

  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { borderWidth: 1, borderColor: '#334158', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  backText: { color: '#cbd4e1', fontSize: 9, fontWeight: '900' },
  screenHeaderText: { flex: 1 },
  screenEyebrow: { color: '#6fb6df', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  screenTitle: { color: '#f5f8fc', fontSize: 22, fontWeight: '900', marginTop: 1 },

  settingsTabs: { flexDirection: 'row', gap: 7 },
  settingsTab: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#303b50', borderRadius: 9, alignItems: 'center', backgroundColor: '#151c27' },
  settingsTabActive: { borderColor: '#6fb6df', backgroundColor: '#1d3143' },
  settingsTabText: { color: '#74839a', fontSize: 9, fontWeight: '900' },
  settingsTabTextActive: { color: '#eef5fb' },
  settingsContent: { gap: 9 },
  sectionHeading: { color: '#f5f8fc', fontSize: 18, fontWeight: '900' },
  sectionIntro: { color: '#8c9aad', fontSize: 11, lineHeight: 17 },
  glossaryItem: { backgroundColor: '#151d29', borderRadius: 11, padding: 11, borderWidth: 1, borderColor: '#253146' },
  glossaryTerm: { color: '#dfeaf4', fontSize: 11, fontWeight: '900' },
  glossaryDescription: { color: '#8795a9', fontSize: 10, lineHeight: 15, marginTop: 3 },
  infoCard: { backgroundColor: '#151d29', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#253146' },
  infoLabel: { color: '#718198', fontSize: 8, fontWeight: '900' },
  infoValue: { color: '#ecf1f7', fontSize: 12, fontWeight: '800', marginTop: 2 },
  ruleCard: { flexDirection: 'row', gap: 10, backgroundColor: '#151d29', borderRadius: 11, padding: 11, borderWidth: 1, borderColor: '#253146' },
  ruleNumber: { color: '#6fb6df', fontSize: 13, fontWeight: '900' },
  ruleTextWrap: { flex: 1 },
  ruleTitle: { color: '#edf2f8', fontSize: 11, fontWeight: '900' },
  ruleBody: { color: '#8795a9', fontSize: 10, lineHeight: 15, marginTop: 3 },

  setupPanel: { backgroundColor: 'rgba(18, 25, 37, 0.92)', borderWidth: 1, borderColor: '#2a3548', borderRadius: 14, padding: 12, gap: 8 },
  setupTitle: { color: '#e7edf5', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  setupTitleSpacing: { marginTop: 5 },
  difficultyRow: { flexDirection: 'row', gap: 8 },
  difficultyButton: { flex: 1, borderWidth: 1, borderColor: '#303b50', borderRadius: 9, paddingVertical: 9, alignItems: 'center', backgroundColor: '#141b26' },
  difficultySelected: { borderColor: '#6fb6df', backgroundColor: '#1d3143' },
  difficultyText: { color: '#7f8da5', fontSize: 9, fontWeight: '900' },
  difficultyTextSelected: { color: '#f6f8fc' },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetButton: { flex: 1, borderWidth: 1, borderColor: '#303b50', borderRadius: 9, paddingVertical: 9, alignItems: 'center', backgroundColor: '#141b26' },
  presetSelected: { borderColor: '#6fb6df', backgroundColor: '#1d3143' },
  presetText: { color: '#7f8da5', fontSize: 9, fontWeight: '900' },
  presetTextSelected: { color: '#f5efff' },
  presetDescription: { color: '#78869a', fontSize: 9 },
  startButton: { marginTop: 9, backgroundColor: '#2e6f52', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  startButtonText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  startButtonHint: { color: '#c8e3d5', fontSize: 9, marginTop: 3 },

  gameHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallMenuButton: { minWidth: 52, paddingVertical: 8, paddingHorizontal: 9, backgroundColor: '#171e2a', borderRadius: 9, borderWidth: 1, borderColor: '#2d394d', alignItems: 'center' },
  smallMenuButtonText: { color: '#d6deea', fontSize: 9, fontWeight: '900' },
  gameTitleWrap: { flex: 1, alignItems: 'center' },
  gameTitle: { color: '#f7f9fc', fontSize: 15, fontWeight: '900' },
  gameSubTitle: { color: '#738198', fontSize: 8, marginTop: 1 },

  phaseBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#171e2a', borderRadius: 10, padding: 9 },
  phaseText: { color: '#f6f8fc', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  phaseHint: { color: '#9f8ac7', fontSize: 10, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', gap: 7 },
  statPill: { flex: 1, backgroundColor: '#171e2a', borderRadius: 11, padding: 8, borderWidth: 1, borderColor: '#273248' },
  statLabel: { color: '#77869b', fontSize: 7, fontWeight: '800' },
  statValue: { color: '#f6f8fc', fontSize: 11, fontWeight: '900', marginTop: 2 },
  enemyMana: { color: '#c28da1', fontSize: 9, fontWeight: '700' },

  resultBox: { backgroundColor: '#20283a', borderRadius: 14, borderWidth: 1, borderColor: '#596b89', padding: 16, alignItems: 'center', gap: 7 },
  resultTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  resultText: { color: '#aab6c8', fontSize: 12, textAlign: 'center' },
  playAgainButton: { marginTop: 4, backgroundColor: '#263c54', paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10 },
  playAgainText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  manaPanel: { gap: 5 },
  manaHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  manaTitle: { color: '#9eacc3', fontSize: 10, fontWeight: '900' },
  manaNumber: { color: '#c6a8ff', fontSize: 12, fontWeight: '900' },
  manaTrack: { height: 8, backgroundColor: '#25213a', borderRadius: 99, overflow: 'hidden' },
  manaFill: { height: '100%', backgroundColor: '#9f7aea' },

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
  message: { color: '#edf2f8', fontSize: 10, fontWeight: '700' },

  logPanel: { borderTopWidth: 1, borderTopColor: '#252f42', paddingTop: 10, gap: 4 },
  logTitle: { color: '#9eacc3', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  logEmpty: { color: '#667489', fontSize: 10 },
  logLine: { color: '#9aa8bc', fontSize: 10 },
});
