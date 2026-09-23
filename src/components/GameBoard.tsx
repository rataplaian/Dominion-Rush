import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canDeployDefinitionAt,
  Entity,
  GameState,
  isProtectedHomeRow,
  territoryOwnerAt,
  UNIT_BY_ID,
  entityAt,
} from '../game';

const ARENA_BG = require('../../assets/arena-bg.jpg');

interface GameBoardProps {
  state: GameState;
  selectedCardId: string;
  onCellPress: (row: number, col: number) => void;
  onEntityPress?: (entity: Entity) => void;
  interactionEnabled?: boolean;
}

function EntityToken({ entity, timeMs }: { entity: Entity; timeMs: number }) {
  const definition = UNIT_BY_ID[entity.definitionId];
  const hpRatio = Math.max(0, Math.min(1, entity.hp / definition.maxHp));

  const attackRemaining = Math.max(0, entity.attackReadyAt - timeMs);
  const attackRatio = definition.attackType === 'none'
    ? 0
    : Math.max(0, Math.min(1, 1 - attackRemaining / definition.attackCooldownMs));

  const moveRemaining = definition.advanceCooldownMs && entity.moveReadyAt !== null
    ? Math.max(0, entity.moveReadyAt - timeMs)
    : null;
  const moveRatio = moveRemaining !== null && definition.advanceCooldownMs
    ? Math.max(0, Math.min(1, 1 - moveRemaining / definition.advanceCooldownMs))
    : null;
  const moveReady = moveRatio !== null && moveRatio >= 0.999;

  return (
    <View style={[styles.token, entity.owner === 'player' ? styles.playerToken : styles.enemyToken]}>
      <View style={styles.tokenMain}>
        <View style={styles.tokenTopRow}>
          <Text style={styles.icon}>{definition.icon}</Text>
        </View>

        <Text style={styles.tokenName} numberOfLines={1}>{definition.shortName}</Text>

        <View style={styles.hpTrack}>
          <View style={[styles.hpFill, { width: `${hpRatio * 100}%` }]} />
        </View>

        {definition.attackType !== 'none' ? (
          <View style={styles.cooldownTrack}>
            <View style={[styles.cooldownFill, { width: `${attackRatio * 100}%` }]} />
          </View>
        ) : (
          <Text style={styles.passiveMark}>■</Text>
        )}
      </View>

      {moveRatio !== null ? (
        <View style={[styles.moveRail, moveReady ? styles.moveRailReady : null]}>
          <View style={styles.moveRailTrack}>
            <View
              style={[
                styles.moveRailFill,
                { height: `${Math.max(6, moveRatio * 100)}%` },
                moveReady ? styles.moveRailFillReady : null,
              ]}
            />
          </View>
          <Text style={[styles.moveArrow, moveReady ? styles.moveArrowReady : null]}>↑</Text>
        </View>
      ) : null}
    </View>
  );
}

function Cell({
  state,
  row,
  col,
  selectedCardId,
  onCellPress,
  onEntityPress,
  interactionEnabled,
}: {
  state: GameState;
  row: number;
  col: number;
  selectedCardId: string;
  onCellPress: (row: number, col: number) => void;
  onEntityPress?: (entity: Entity) => void;
  interactionEnabled: boolean;
  key?: string;
}) {
  const entity = entityAt(state, row, col);
  const definition = UNIT_BY_ID[selectedCardId];
  const normalOwner = territoryOwnerAt(state, row, col);
  const canAttemptDeploy = Boolean(
    interactionEnabled &&
    definition &&
    !state.winner &&
    canDeployDefinitionAt(state, 'player', definition, row, col).ok,
  );

  const repelReady = Boolean(
    canAttemptDeploy &&
    entity &&
    entity.owner === 'enemy' &&
    isProtectedHomeRow('player', row),
  );

  const claimablePlayerHalfCell = Boolean(
    interactionEnabled &&
    !entity &&
    row > Math.floor(BOARD_ROWS / 2) &&
    normalOwner !== 'player',
  );

  const protectedRow =
    (normalOwner === 'player' || normalOwner === 'enemy')
      ? isProtectedHomeRow(normalOwner, row)
      : false;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`row ${row + 1}, column ${col + 1}${entity ? `, ${UNIT_BY_ID[entity.definitionId].name}` : ', empty'}${repelReady ? ', repel deployment available' : ''}`}
      onPress={() => {
        if (repelReady && interactionEnabled) {
          onCellPress(row, col);
          return;
        }
        if (entity && onEntityPress) onEntityPress(entity);
        else if (interactionEnabled) onCellPress(row, col);
      }}
      disabled={Boolean(!interactionEnabled && !entity)}
      style={({ pressed }) => [
        styles.cell,
        normalOwner === 'enemy' ? styles.enemyTerritory : normalOwner === 'player' ? styles.playerTerritory : styles.neutralTerritory,
        protectedRow ? styles.protectedHome : null,
        canAttemptDeploy ? styles.deployable : null,
        repelReady ? styles.repelReady : null,
        claimablePlayerHalfCell ? styles.claimable : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {entity ? (
        <View style={styles.entityCell}>
          <EntityToken entity={entity} timeMs={state.timeMs} />
          {repelReady ? <Text style={styles.repelMark}>DEPLOY ↥</Text> : null}
        </View>
      ) : (
        <Text style={styles.cellDot}>·</Text>
      )}
    </Pressable>
  );
}

export function GameBoard({
  state,
  selectedCardId,
  onCellPress,
  onEntityPress,
  interactionEnabled = true,
}: GameBoardProps) {
  const normalRows = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const cells = [];
    for (let col = 0; col < BOARD_COLS; col += 1) {
      cells.push(
        <Cell
          key={`${row}-${col}`}
          state={state}
          row={row}
          col={col}
          selectedCardId={selectedCardId}
          onCellPress={onCellPress}
          onEntityPress={onEntityPress}
          interactionEnabled={interactionEnabled}
        />,
      );
    }
    normalRows.push(<View key={row} style={styles.row}>{cells}</View>);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.sideLabelRow}>
        <Text style={styles.sideLabel}>DYNAMIC TERRITORY</Text>
        <Text style={styles.hint}>glowing ↑ = free move ready</Text>
      </View>
      <ImageBackground
        source={ARENA_BG}
        resizeMode="cover"
        style={styles.arenaArt}
        imageStyle={styles.arenaImage}
      >
        <View style={styles.board}>{normalRows}</View>
      </ImageBackground>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Blue = yours</Text>
        <Text style={styles.legendText}>Red = enemy</Text>
        <Text style={styles.legendText}>Cyan border = claimable territory</Text>
        <Text style={styles.legendText}>Claim = 1 mana connected · 2 isolated</Text>
        <Text style={styles.legendText}>Bright = deployable</Text>
        <Text style={styles.legendText}>Gold border = protected home row</Text>
        <Text style={styles.legendText}>DEPLOY ↥ = replace invader and push it back</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  wrapper: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  arenaArt: { width: '100%', aspectRatio: 941 / 1672, position: 'relative', overflow: 'hidden', borderRadius: 14 },
  arenaImage: { borderRadius: 14 },
  board: { position: 'absolute', left: '13.5%', right: '13.5%', top: '20.1%' },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 0,
  },
  enemyTerritory: { backgroundColor: 'rgba(112, 32, 52, 0.10)' },
  playerTerritory: { backgroundColor: 'rgba(31, 122, 178, 0.10)' },
  neutralTerritory: { backgroundColor: 'rgba(82, 145, 220, 0.14)' },
  protectedHome: { borderColor: '#b99b4c', borderWidth: 1.5 },
  repelReady: { borderColor: '#ffe08a', borderWidth: 2, backgroundColor: 'rgba(90, 69, 20, 0.28)' },
  entityCell: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  repelMark: { position: 'absolute', bottom: 1, color: '#ffe08a', fontSize: 6, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 2 },
  deployable: { backgroundColor: 'rgba(56, 191, 255, 0.16)' },
  claimable: { borderColor: '#66d9e8', borderWidth: 2 },
  pressed: { opacity: 0.72 },
  cellDot: { color: 'rgba(255,255,255,0.15)', fontSize: 16 },
  token: {
    width: '86%',
    height: '86%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
    position: 'relative',
  },
  tokenMain: { width: '88%', alignItems: 'center', justifyContent: 'center', paddingRight: 7 },
  playerToken: { backgroundColor: '#174b6b', borderColor: '#6fb6df' },
  enemyToken: { backgroundColor: '#633042', borderColor: '#d48aa3' },
  tokenTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { fontSize: 16, lineHeight: 18 },
  moveTimer: { color: '#eef2f7', fontSize: 7, fontWeight: '900' },
  moveRail: { position: 'absolute', right: 2, top: 3, bottom: 3, width: 11, alignItems: 'center', justifyContent: 'space-between', opacity: 0.68 },
  moveRailReady: { opacity: 1 },
  moveRailTrack: { flex: 1, width: 5, borderRadius: 99, backgroundColor: '#17202d', overflow: 'hidden', justifyContent: 'flex-end', borderWidth: 0.5, borderColor: '#526174' },
  moveRailFill: { width: '100%', backgroundColor: '#76889d' },
  moveRailFillReady: { backgroundColor: '#d9bf74' },
  moveArrow: { color: '#718197', fontSize: 10, lineHeight: 11, fontWeight: '900', marginTop: 1 },
  moveArrowReady: { color: '#ffe08a', textShadowColor: '#ffe08a', textShadowRadius: 5 },
  tokenName: { color: '#fff', fontSize: 8, fontWeight: '900', marginTop: -1 },
  hpTrack: { width: '86%', height: 4, backgroundColor: '#121722', borderRadius: 99, overflow: 'hidden', marginTop: 2 },
  hpFill: { height: '100%', backgroundColor: '#7bd389' },
  cooldownTrack: { width: '86%', height: 3, backgroundColor: '#161c29', borderRadius: 99, overflow: 'hidden', marginTop: 2 },
  cooldownFill: { height: '100%', backgroundColor: '#d9bf74' },
  passiveMark: { color: '#708096', fontSize: 6, lineHeight: 7, marginTop: 1 },
  sideLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
  sideLabel: { color: '#9eacc3', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  hint: { color: '#68758a', fontSize: 9 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  legendText: { color: '#65748a', fontSize: 9 },
});
