import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TrackedDevice } from '@/ble/BleScanner';
import { estimateDistance, formatDistance, PathLossConfig } from '@/signal/distance';
import { classify, strength } from '@/signal/proximity';
import { colors, mono, radius, space, type } from '@/theme/theme';
import { displayName, hasAdvertisedName, shortId, trendGlyph } from '@/utils/format';
import { Pill, StrengthBar } from '@/components/ui';

interface Props {
  device: TrackedDevice;
  alias?: string;
  pathLoss: PathLossConfig;
  onPress: (device: TrackedDevice) => void;
}

function DeviceCardBase({ device, alias, pathLoss, onPress }: Props) {
  const band = classify(device.smoothedRssi, device.isStale);
  const level = strength(device.smoothedRssi, device.isStale);
  const distance = device.isStale
    ? null
    : estimateDistance(device.smoothedRssi, pathLoss);

  const { kind, vendor } = device.deviceClass;

  return (
    <Pressable
      onPress={() => onPress(device)}
      accessibilityRole="button"
      accessibilityLabel={`${displayName(device, alias)}, ${band.label}, ${
        device.smoothedRssi ?? '--'
      } dBm`}
      style={({ pressed }) => [
        styles.card,
        { borderColor: device.isStale ? colors.border : `${band.color}44` },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.identity}>
          <Text
            style={[
              styles.name,
              !hasAdvertisedName(device) && !alias && styles.nameUnknown,
            ]}
            numberOfLines={1}
          >
            {displayName(device, alias)}
          </Text>
          <Text style={styles.id} numberOfLines={1}>
            {shortId(device.id)}
          </Text>
        </View>

        <View style={styles.readouts}>
          <Text style={[styles.rssi, { color: band.color }]}>
            {device.smoothedRssi !== null ? device.smoothedRssi.toFixed(0) : '--'}
            <Text style={styles.unit}> dBm</Text>
          </Text>
          <Text style={styles.distance}>
            ≈ {formatDistance(distance)}{' '}
            <Text style={{ color: band.color }}>{trendGlyph(device.trend)}</Text>
          </Text>
        </View>
      </View>

      <StrengthBar value={level} color={band.color} />

      <View style={styles.tags}>
        <Pill color={band.color}>{band.label}</Pill>
        {alias ? <Pill color={colors.immediate}>Renamed</Pill> : null}
        {kind ? <Pill>{kind}</Pill> : null}
        {vendor ? <Pill>{vendor}</Pill> : null}
        {device.isConnectable === true ? <Pill>Connectable</Pill> : null}
        {device.isConnectable === false ? <Pill>Broadcast only</Pill> : null}
        {device.isStale ? <Pill color={colors.warn}>Signal lost</Pill> : null}
      </View>
    </Pressable>
  );
}

export const DeviceCard = memo(
  DeviceCardBase,
  (a, b) =>
    a.device.id === b.device.id &&
    a.device.smoothedRssi === b.device.smoothedRssi &&
    a.device.isStale === b.device.isStale &&
    a.device.trend === b.device.trend &&
    a.device.name === b.device.name &&
    a.alias === b.alias &&
    a.pathLoss === b.pathLoss,
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  pressed: { opacity: 0.65 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  identity: { flex: 1, gap: 3 },
  name: { ...type.title },
  nameUnknown: { color: colors.textMuted, fontStyle: 'italic' },
  id: { fontFamily: mono, fontSize: 11, color: colors.textFaint },
  readouts: { alignItems: 'flex-end', gap: 3 },
  rssi: { fontFamily: mono, fontSize: 20 },
  unit: { fontSize: 10, color: colors.textMuted },
  distance: { fontFamily: mono, fontSize: 11, color: colors.textMuted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
