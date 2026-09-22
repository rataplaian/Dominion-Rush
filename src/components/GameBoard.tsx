import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canDeployDefinitionAt,
  Entity,
  GameState,
  getEmergencyRow,
  isEmergencyCellActive,
  isProtectedHomeRow,
  territoryOwnerAt,
  UNIT_BY_ID,
  entityAt,
} from '../game';

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

  return (
    <View style={[styles.token, entity.owner === 'player' ? styles.playerToken : styles.enemyToken]}>
      <View style={styles.tokenTopRow}>
        <Text style={styles.icon}>{definition.icon}</Text>
        {moveRemaining !== null ? (
          <Text style={styles.moveTimer}>{Math.ceil(moveRemaining / 1000)}s↑</Text>
        ) : null}
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
  emergencySide,
}: {
  state: GameState;
  row: number;
  col: number;
  selectedCardId: string;
  onCellPress: (row: number, col: number) => void;
  onEntityPress?: (entity: Entity) => void;
  interactionEnabled: boolean;
  emergencySide?: 'player' | 'enemy';
  key?: string;
}) {
  const entity = entityAt(state, row, col);
  const definition = UNIT_BY_ID[selectedCardId];
  const normalOwner = emergencySide ? emergencySide : territoryOwnerAt(state, row, col);
  const activeEmergency = emergencySide ? isEmergencyCellActive(state, emergencySide, col) : false;
  const canAttemptDeploy = Boolean(
    interactionEnabled &&
    definition &&
    !state.winner &&
    canDeployDefinitionAt(state, 'player', definition, row, col).ok,
  );

  const protectedRow = !emergencySide && normalOwner ? isProtectedHomeRow(normalOwner, row) : false;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${emergencySide ? 'Emergency ' : ''}row ${row + 1}, column ${col + 1}${entity ? `, ${UNIT_BY_ID[entity.definitionId].name}` : ', empty'}`}
      onPress={() => {
        if (entity && onEntityPress) onEntityPress(entity);
        else if (interactionEnabled) onCellPress(row, col);
      }}
      disabled={Boolean((emergencySide && !activeEmergency && !entity) || (!interactionEnabled && !entity))}
      style={({ pressed }) => [
        styles.cell,
        emergencySide ? styles.emergencyCell : null,
        normalOwner === 'enemy' ? styles.enemyTerritory : styles.playerTerritory,
        protectedRow ? styles.protectedHome : null,
        emergencySide && !activeEmergency && !entity ? styles.inactiveEmergency : null,
        canAttemptDeploy ? styles.deployable : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {entity ? (
        <EntityToken entity={entity} timeMs={state.timeMs} />
      ) : emergencySide && activeEmergency ? (
        <Text style={styles.emergencyMark}>+</Text>
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

  const renderEmergencyRow = (side: 'player' | 'enemy') => {
    const row = getEmergencyRow(side);
    const anyVisible = Array.from({ length: BOARD_COLS }, (_, col) =>
      isEmergencyCellActive(state, side, col) || Boolean(entityAt(state, row, col)),
    ).some(Boolean);
    if (!anyVisible) return null;

    return (
      <View style={styles.emergencyWrap}>
        <Text style={styles.emergencyLabel}>{side === 'player' ? 'YOUR EMERGENCY LINE' : 'ENEMY EMERGENCY LINE'}</Text>
        <View style={styles.row}>
          {Array.from({ length: BOARD_COLS }, (_, col) => (
            <Cell
              key={`em-${side}-${col}`}
              state={state}
              row={row}
              col={col}
              selectedCardId={selectedCardId}
              onCellPress={onCellPress}
              onEntityPress={onEntityPress}
              interactionEnabled={interactionEnabled}
              emergencySide={side}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {renderEmergencyRow('enemy')}
      <View style={styles.sideLabelRow}>
        <Text style={styles.sideLabel}>DYNAMIC TERRITORY</Text>
        <Text style={styles.hint}>tap a unit to inspect it</Text>
      </View>
      <View style={styles.board}>{normalRows}</View>
      {renderEmergencyRow('player')}
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Blue = yours</Text>
        <Text style={styles.legendText}>Red = enemy</Text>
        <Text style={styles.legendText}>Bright = deployable</Text>
        <Text style={styles.legendText}>Gold border = protected</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  board: { borderWidth: 2, borderColor: '#273248', borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#33415c',
    minWidth: 0,
  },
  enemyTerritory: { backgroundColor: '#201d2a' },
  playerTerritory: { backgroundColor: '#13263a' },
  protectedHome: { borderColor: '#b99b4c', borderWidth: 1.5 },
  deployable: { backgroundColor: '#1d4260' },
  pressed: { opacity: 0.72 },
  cellDot: { color: '#62708a', fontSize: 20 },
  token: {
    width: '86%',
    height: '86%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  playerToken: { backgroundColor: '#174b6b', borderColor: '#6fb6df' },
  enemyToken: { backgroundColor: '#633042', borderColor: '#d48aa3' },
  tokenTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { fontSize: 16, lineHeight: 18 },
  moveTimer: { color: '#eef2f7', fontSize: 7, fontWeight: '900' },
  tokenName: { color: '#fff', fontSize: 8, fontWeight: '900', marginTop: -1 },
  hpTrack: { width: '86%', height: 4, backgroundColor: '#121722', borderRadius: 99, overflow: 'hidden', marginTop: 2 },
  hpFill: { height: '100%', backgroundColor: '#7bd389' },
  cooldownTrack: { width: '86%', height: 3, backgroundColor: '#161c29', borderRadius: 99, overflow: 'hidden', marginTop: 2 },
  cooldownFill: { height: '100%', backgroundColor: '#d9bf74' },
  passiveMark: { color: '#708096', fontSize: 6, lineHeight: 7, marginTop: 1 },
  sideLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
  sideLabel: { color: '#9eacc3', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  hint: { color: '#68758a', fontSize: 9 },
  emergencyWrap: { marginVertical: 5 },
  emergencyLabel: { color: '#c5ab6c', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 3 },
  emergencyCell: { maxHeight: 64, borderStyle: 'dashed' },
  inactiveEmergency: { opacity: 0.13 },
  emergencyMark: { color: '#e6d095', fontSize: 20, fontWeight: '900' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  legendText: { color: '#65748a', fontSize: 9 },
});
