import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useScanner } from '@/ble/useBleScanner';
import { ProximityMeter } from '@/components/ProximityMeter';
import { RssiChart } from '@/components/RssiChart';
import { Disclaimer } from '@/components/StateViews';
import { Button, Label, Panel, Pill } from '@/components/ui';
import type { RootStackParamList } from '@/navigation';
import {
  distanceRange,
  estimateDistance,
  formatDistance,
} from '@/signal/distance';
import { classify, ProximityLevel, strength } from '@/signal/proximity';
import { useSettings } from '@/storage/SettingsContext';
import { colors, mono, radius, space, type } from '@/theme/theme';
import { secondsAgo, shortId, trendLabel } from '@/utils/format';
import { pulseForLevel, pulseThresholdCrossed, tap } from '@/utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Track'>;
type Route = RouteProp<RootStackParamList, 'Track'>;

export function TrackScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const scanner = useScanner();
  const { settings, setAlias } = useSettings();

  const device = scanner.deviceById(params.deviceId);
  const alias = settings.aliases[params.deviceId];
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(alias ?? '');

  // Keep this device alive in the scanner even when it stops advertising.
  useEffect(() => {
    scanner.pinDevice(params.deviceId);
    return () => scanner.pinDevice(null);
  }, [params.deviceId, scanner]);

  const smoothed = device?.smoothedRssi ?? null;
  const isStale = device?.isStale ?? true;
  const band = classify(smoothed, isStale);
  const level = strength(smoothed, isStale);

  const distance = isStale ? null : estimateDistance(smoothed, settings.pathLoss);
  const range = distanceRange(distance);

  useProximityHaptics(band.level, smoothed, isStale);

  const chartWidth = Math.min(width, 520) - space.lg * 4;

  const saveAlias = useCallback(() => {
    setAlias(params.deviceId, draft);
    setRenaming(false);
    tap();
  }, [draft, params.deviceId, setAlias]);

  const heading = alias || device?.name || device?.localName || 'Unnamed device';

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          {renaming ? (
            <View style={styles.renameRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                placeholder="My keys"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={saveAlias}
                maxLength={32}
              />
              <Button title="Save" onPress={saveAlias} tint={band.color} />
            </View>
          ) : (
            <>
              <Text style={styles.heading} numberOfLines={1}>
                {heading}
              </Text>
              <Text style={styles.identifier}>{shortId(params.deviceId)}</Text>
              <View style={styles.tags}>
                <Pill color={band.color}>{band.detail}</Pill>
                {device?.deviceClass.kind ? (
                  <Pill>{device.deviceClass.kind}</Pill>
                ) : null}
                {device?.deviceClass.vendor ? (
                  <Pill>{device.deviceClass.vendor}</Pill>
                ) : null}
              </View>
            </>
          )}
        </View>

        <View style={styles.meterWrap}>
          <ProximityMeter
            strength={level}
            band={band}
            primary={isStale ? '--' : formatDistance(distance)}
            secondary={
              isStale
                ? `lost ${secondsAgo(device?.lastSeen ?? Date.now())}`
                : range
                ? `${formatDistance(range.low)} – ${formatDistance(range.high)}`
                : ''
            }
            size={Math.min(width - space.xl * 2, 300)}
            isLost={isStale}
          />
        </View>

        {isStale ? (
          <Panel style={{ borderColor: `${colors.warn}55` }}>
            <Label>Signal lost</Label>
            <Text style={styles.lostBody}>
              No advertisements for {secondsAgo(device?.lastSeen ?? Date.now())}.
              The device may be out of range, asleep, or rotating its identifier.
              Scanning continues — walk back the way you came.
            </Text>
          </Panel>
        ) : null}

        <View style={styles.metrics}>
          <Metric
            label="Smoothed"
            value={smoothed !== null ? smoothed.toFixed(1) : '--'}
            unit="dBm"
            tint={band.color}
          />
          <Metric
            label="Raw"
            value={device?.rssi !== null && device?.rssi !== undefined ? String(device.rssi) : '--'}
            unit="dBm"
          />
          <Metric
            label="Trend"
            value={device ? trendLabel(device.trend) : '--'}
            tint={
              device?.trend === 'improving'
                ? colors.immediate
                : device?.trend === 'weakening'
                ? colors.warn
                : colors.textMuted
            }
            small
          />
        </View>

        <Panel style={styles.chartPanel}>
          <View style={styles.panelHead}>
            <Label>Signal history</Label>
            <Text style={styles.samples}>{device?.sampleCount ?? 0} samples</Text>
          </View>
          <RssiChart
            samples={device?.history ?? []}
            color={band.color}
            width={chartWidth}
            markerDbm={settings.haptics.enabled ? settings.haptics.thresholdDbm : null}
          />
        </Panel>

        <Panel>
          <Label>Advertisement</Label>
          <Row label="Identifier" value={params.deviceId} monoValue />
          <Row
            label="Advertised name"
            value={device?.name ?? device?.localName ?? 'not broadcast'}
          />
          <Row
            label="Tx power"
            value={
              device?.txPowerLevel !== null && device?.txPowerLevel !== undefined
                ? `${device.txPowerLevel} dBm`
                : 'not broadcast'
            }
          />
          <Row
            label="Connectable"
            value={
              device?.isConnectable === null || device?.isConnectable === undefined
                ? 'unknown'
                : device.isConnectable
                ? 'yes'
                : 'broadcast only'
            }
          />
          <Row
            label="Services"
            value={
              device?.serviceUUIDs.length
                ? device.serviceUUIDs.join(', ')
                : 'none advertised'
            }
            monoValue
          />
          <Row label="Last packet" value={secondsAgo(device?.lastSeen ?? Date.now())} />
        </Panel>

        <View style={styles.actions}>
          <Button
            title={alias ? 'Rename' : 'Name this device'}
            tint={band.color}
            onPress={() => {
              setDraft(alias ?? '');
              setRenaming(true);
              tap();
            }}
            style={styles.flex}
          />
          <Button
            title="Calibrate"
            variant="ghost"
            onPress={() => navigation.navigate('Calibration', { deviceId: params.deviceId })}
            style={styles.flex}
          />
        </View>

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Fires haptics on band changes and on crossing the user's dBm threshold.
 * Both directions are reported, and repeat pulses are suppressed until the
 * signal actually moves back across the line.
 */
function useProximityHaptics(
  level: ProximityLevel,
  smoothed: number | null,
  isStale: boolean,
) {
  const { settings } = useSettings();
  const lastLevel = useRef<ProximityLevel | null>(null);
  const wasAbove = useRef<boolean | null>(null);

  useEffect(() => {
    if (!settings.haptics.enabled || isStale || smoothed === null) return;

    if (settings.haptics.onBandChange && lastLevel.current !== level) {
      if (lastLevel.current !== null) pulseForLevel(level);
      lastLevel.current = level;
    }

    const above = smoothed >= settings.haptics.thresholdDbm;
    if (wasAbove.current !== null && above !== wasAbove.current) {
      pulseThresholdCrossed();
    }
    wasAbove.current = above;
  }, [level, smoothed, isStale, settings.haptics]);
}

function Metric({
  label,
  value,
  unit,
  tint = colors.text,
  small = false,
}: {
  label: string;
  value: string;
  unit?: string;
  tint?: string;
  small?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Label>{label}</Label>
      <Text
        style={[styles.metricValue, { color: tint, fontSize: small ? 13 : 22 }]}
        numberOfLines={1}
      >
        {value}
        {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function Row({
  label,
  value,
  monoValue = false,
}: {
  label: string;
  value: string;
  monoValue?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, monoValue && { fontFamily: mono, fontSize: 11 }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  identity: { gap: space.sm },
  heading: { fontSize: 24, fontWeight: '600', color: colors.text },
  identifier: { fontFamily: mono, fontSize: 12, color: colors.textFaint },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.xs },
  renameRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  meterWrap: { alignItems: 'center', paddingVertical: space.sm },
  lostBody: { ...type.body, marginTop: space.sm },
  metrics: { flexDirection: 'row', gap: space.md },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.md,
    gap: space.xs,
  },
  metricValue: { fontFamily: mono },
  metricUnit: { fontSize: 10, color: colors.textMuted },
  chartPanel: { gap: space.md },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  samples: { fontFamily: mono, fontSize: 11, color: colors.textFaint },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingTop: space.md,
  },
  detailLabel: { fontSize: 12, color: colors.textMuted, flexShrink: 0 },
  detailValue: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },
  actions: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
