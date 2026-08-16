import { useRoute, RouteProp } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useScanner } from '@/ble/useBleScanner';
import { Button, Label, Panel } from '@/components/ui';
import type { RootStackParamList } from '@/navigation';
import {
  calibrateMeasuredPower,
  ENVIRONMENT_PRESETS,
  estimateDistance,
  formatDistance,
} from '@/signal/distance';
import { useSettings } from '@/storage/SettingsContext';
import { colors, mono, radius, space, type } from '@/theme/theme';
import { tap } from '@/utils/haptics';

type Route = RouteProp<RootStackParamList, 'Calibration'>;

const REFERENCE_METRES = 1;

export function CalibrationScreen() {
  const { params } = useRoute<Route>();
  const scanner = useScanner();
  const { settings, update, resetCalibration } = useSettings();
  const [captured, setCaptured] = useState<number | null>(null);

  const device = params?.deviceId ? scanner.deviceById(params.deviceId) : undefined;
  const { pathLoss, filter, haptics } = settings;

  const preview = useMemo(
    () =>
      [-50, -60, -70, -80, -90].map((rssi) => ({
        rssi,
        distance: estimateDistance(rssi, pathLoss),
      })),
    [pathLoss],
  );

  const capture = () => {
    if (device?.smoothedRssi == null) return;
    const measuredPower = calibrateMeasuredPower(
      device.smoothedRssi,
      REFERENCE_METRES,
      pathLoss.environmentalFactor,
    );
    setCaptured(device.smoothedRssi);
    update({ pathLoss: { ...pathLoss, measuredPower: Math.round(measuredPower) } });
    tap();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Every radio transmits at a different power, and every room absorbs it
          differently. Tune these two numbers and the distance estimate gets
          meaningfully closer to reality.
        </Text>

        <Panel style={styles.panel}>
          <Label>Reference power · RSSI at 1 metre</Label>
          <View style={styles.stepperRow}>
            <Stepper
              onPress={() =>
                update({
                  pathLoss: { ...pathLoss, measuredPower: pathLoss.measuredPower - 1 },
                })
              }
              glyph="−"
            />
            <Text style={styles.bigValue}>
              {pathLoss.measuredPower}
              <Text style={styles.unit}> dBm</Text>
            </Text>
            <Stepper
              onPress={() =>
                update({
                  pathLoss: { ...pathLoss, measuredPower: pathLoss.measuredPower + 1 },
                })
              }
              glyph="+"
            />
          </View>

          {device ? (
            <>
              <Text style={styles.help}>
                Hold your phone exactly 1 m from the device with nothing in
                between, wait for the reading to settle, then capture.
              </Text>
              <View style={styles.captureRow}>
                <Text style={styles.liveRssi}>
                  live {device.smoothedRssi?.toFixed(1) ?? '--'} dBm
                </Text>
                <Button
                  title={captured !== null ? 'Captured' : 'Capture at 1 m'}
                  tint={colors.close}
                  onPress={capture}
                  disabled={device.smoothedRssi === null}
                />
              </View>
            </>
          ) : (
            <Text style={styles.help}>
              Open this screen from a tracked device to capture a live reference
              reading instead of setting it by hand.
            </Text>
          )}
        </Panel>

        <Panel style={styles.panel}>
          <Label>Environment · path-loss exponent</Label>
          <View style={styles.presets}>
            {ENVIRONMENT_PRESETS.map((preset) => {
              const active =
                Math.abs(preset.environmentalFactor - pathLoss.environmentalFactor) <
                0.05;
              return (
                <Pressable
                  key={preset.key}
                  onPress={() => {
                    tap();
                    update({
                      pathLoss: {
                        ...pathLoss,
                        environmentalFactor: preset.environmentalFactor,
                      },
                    });
                  }}
                  style={[styles.preset, active && styles.presetActive]}
                >
                  <Text style={[styles.presetLabel, active && { color: colors.nearby }]}>
                    {preset.label}
                  </Text>
                  <Text style={styles.presetHint}>{preset.hint}</Text>
                  <Text style={styles.presetValue}>
                    n = {preset.environmentalFactor.toFixed(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Panel>

        <Panel style={styles.panel}>
          <Label>Smoothing · EMA weight</Label>
          <View style={styles.stepperRow}>
            <Stepper
              onPress={() =>
                update({
                  filter: {
                    ...filter,
                    alpha: Math.max(0.05, Math.round((filter.alpha - 0.05) * 100) / 100),
                  },
                })
              }
              glyph="−"
            />
            <Text style={styles.bigValue}>{filter.alpha.toFixed(2)}</Text>
            <Stepper
              onPress={() =>
                update({
                  filter: {
                    ...filter,
                    alpha: Math.min(1, Math.round((filter.alpha + 0.05) * 100) / 100),
                  },
                })
              }
              glyph="+"
            />
          </View>
          <Text style={styles.help}>
            Lower is steadier but slower to react. Higher follows movement
            closely and jitters more.
          </Text>
        </Panel>

        <Panel style={styles.panel}>
          <Label>Haptics</Label>
          <ToggleRow
            title="Vibrate on signal changes"
            value={haptics.enabled}
            onChange={(v) => update({ haptics: { ...haptics, enabled: v } })}
          />
          <ToggleRow
            title="Pulse on every proximity change"
            value={haptics.onBandChange}
            onChange={(v) => update({ haptics: { ...haptics, onBandChange: v } })}
            disabled={!haptics.enabled}
          />
          <View style={styles.thresholdRow}>
            <View style={styles.flex}>
              <Text style={styles.toggleTitle}>Alert threshold</Text>
              <Text style={styles.help}>
                Buzz whenever the signal crosses this level in either direction.
              </Text>
            </View>
            <View style={styles.thresholdControl}>
              <Stepper
                glyph="−"
                onPress={() =>
                  update({
                    haptics: { ...haptics, thresholdDbm: haptics.thresholdDbm - 5 },
                  })
                }
              />
              <Text style={styles.thresholdValue}>{haptics.thresholdDbm}</Text>
              <Stepper
                glyph="+"
                onPress={() =>
                  update({
                    haptics: { ...haptics, thresholdDbm: haptics.thresholdDbm + 5 },
                  })
                }
              />
            </View>
          </View>
        </Panel>

        <Panel style={styles.panel}>
          <Label>Model preview</Label>
          {preview.map((row) => (
            <View key={row.rssi} style={styles.previewRow}>
              <Text style={styles.previewRssi}>{row.rssi} dBm</Text>
              <View style={styles.previewLine} />
              <Text style={styles.previewDistance}>{formatDistance(row.distance)}</Text>
            </View>
          ))}
        </Panel>

        <Button
          title="Reset to defaults"
          variant="ghost"
          onPress={() => {
            tap();
            resetCalibration();
            setCaptured(null);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ glyph, onPress }: { glyph: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={glyph === '+' ? 'increase' : 'decrease'}
      style={({ pressed }) => [styles.stepper, pressed && { opacity: 0.5 }]}
    >
      <Text style={styles.stepperGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function ToggleRow({
  title,
  value,
  onChange,
  disabled,
}: {
  title: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.4 }]}>
      <Text style={styles.toggleTitle}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: `${colors.nearby}88`, false: colors.border }}
        thumbColor={value ? colors.nearby : colors.textFaint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  intro: { ...type.body },
  panel: { gap: space.md },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigValue: { fontFamily: mono, fontSize: 30, color: colors.text },
  unit: { fontSize: 12, color: colors.textMuted },
  stepper: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: { fontFamily: mono, fontSize: 20, color: colors.text },
  help: { ...type.body, fontSize: 12 },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  liveRssi: { fontFamily: mono, fontSize: 13, color: colors.close },
  presets: { gap: space.sm },
  preset: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.md,
    gap: 2,
  },
  presetActive: {
    borderColor: `${colors.nearby}99`,
    backgroundColor: `${colors.nearby}12`,
  },
  presetLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  presetHint: { fontSize: 11, color: colors.textMuted },
  presetValue: { fontFamily: mono, fontSize: 11, color: colors.textFaint },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  toggleTitle: { fontSize: 14, color: colors.text, flex: 1 },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thresholdControl: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  thresholdValue: {
    fontFamily: mono,
    fontSize: 16,
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  flex: { flex: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  previewRssi: {
    fontFamily: mono,
    fontSize: 12,
    color: colors.textMuted,
    width: 68,
  },
  previewLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  previewDistance: {
    fontFamily: mono,
    fontSize: 13,
    color: colors.text,
    width: 70,
    textAlign: 'right',
  },
});
