import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TrackedDevice } from '@/ble/BleScanner';
import { useScanner } from '@/ble/useBleScanner';
import { DeviceCard } from '@/components/DeviceCard';
import { Disclaimer, ScanningIndicator, StateView } from '@/components/StateViews';
import { Button, Label } from '@/components/ui';
import { useSettings } from '@/storage/SettingsContext';
import { colors, mono, space, type } from '@/theme/theme';
import { tap } from '@/utils/haptics';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Scan'>;

export function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const scanner = useScanner();
  const { settings } = useSettings();

  const openDevice = useCallback(
    (device: TrackedDevice) => {
      tap();
      scanner.pinDevice(device.id);
      navigation.navigate('Track', { deviceId: device.id });
    },
    [navigation, scanner],
  );

  const activeCount = useMemo(
    () => scanner.devices.filter((d) => !d.isStale).length,
    [scanner.devices],
  );

  const stateView = useStateView();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.wordmark}>PROXIMIS</Text>
            <Text style={type.label}>Bluetooth proximity scanner</Text>
          </View>
          <Button
            title="Calibrate"
            variant="ghost"
            onPress={() => {
              tap();
              navigation.navigate('Calibration', {});
            }}
          />
        </View>

        <View style={styles.stats}>
          <Stat label="In range" value={String(activeCount)} tint={colors.close} />
          <Stat label="Seen" value={String(scanner.devices.length)} />
          <Stat
            label="Radio"
            value={scanner.isReady ? 'SCANNING' : scanner.status.toUpperCase()}
            tint={scanner.isReady ? colors.nearby : colors.warn}
          />
        </View>

        <ScanningIndicator active={scanner.isReady} />
      </View>

      {stateView ?? (
        <FlatList
          data={scanner.devices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              alias={settings.aliases[item.id]}
              pathLoss={settings.pathLoss}
              onPress={openDevice}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Label>Strongest first · updates live</Label>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <Disclaimer />
              <Button
                title="Clear list"
                variant="ghost"
                onPress={() => {
                  tap();
                  scanner.clearDevices();
                }}
              />
            </View>
          }
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

/** Chooses which non-content state, if any, replaces the list. */
function useStateView(): React.ReactElement | null {
  const scanner = useScanner();

  if (scanner.permission && scanner.permission !== 'granted') {
    const blocked = scanner.permission === 'blocked';
    return (
      <StateView
        eyebrow="Permission needed"
        tint={colors.warn}
        title={blocked ? 'Bluetooth access is turned off' : 'Allow nearby device access'}
        body={
          blocked
            ? 'Scanning stays off until Bluetooth permission is granted in system settings.'
            : 'Android requires nearby-device permission before an app can see Bluetooth advertisements.'
        }
        actionLabel={blocked ? 'Open settings' : 'Grant access'}
        onAction={() =>
          blocked ? Linking.openSettings() : void scanner.requestAccess()
        }
      />
    );
  }

  switch (scanner.status) {
    case 'poweredOff':
      return (
        <StateView
          eyebrow="Bluetooth off"
          tint={colors.warn}
          title="Turn Bluetooth on to scan"
          body="The radio is powered down. Scanning resumes on its own once Bluetooth is back on."
          actionLabel="Open settings"
          onAction={() => Linking.openSettings()}
        />
      );
    case 'unsupported':
      return (
        <StateView
          eyebrow="Unsupported"
          tint={colors.danger}
          title="No Bluetooth Low Energy radio"
          body="This hardware does not expose a BLE central role, so nearby devices cannot be scanned."
        />
      );
    case 'unauthorized':
      return (
        <StateView
          eyebrow="Blocked"
          tint={colors.danger}
          title="Bluetooth access was denied"
          body="Grant Bluetooth permission in system settings, then return to resume scanning."
          actionLabel="Open settings"
          onAction={() => Linking.openSettings()}
        />
      );
    case 'error':
      return (
        <StateView
          eyebrow="Scan failed"
          tint={colors.danger}
          title="The scan stopped unexpectedly"
          body={scanner.error ?? 'The Bluetooth stack returned an error.'}
          actionLabel="Try again"
          onAction={() => void scanner.startScan()}
        />
      );
    case 'starting':
    case 'idle':
      return (
        <StateView
          eyebrow="Starting"
          title="Powering up the radio"
          body="Waiting for the Bluetooth adapter to report ready."
        />
      );
    default:
      break;
  }

  if (!scanner.devices.length) {
    return (
      <StateView
        eyebrow="Listening"
        title="No advertisements yet"
        body="Nothing nearby is broadcasting. Wake a device, or move closer to one — most devices advertise only every few seconds."
      />
    );
  }
  return null;
}

function Stat({
  label,
  value,
  tint = colors.text,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={type.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: mono,
    fontSize: 22,
    letterSpacing: 4,
    color: colors.text,
  },
  stats: { flexDirection: 'row', gap: space.xl },
  stat: { gap: 2 },
  statValue: { fontFamily: mono, fontSize: 18 },
  list: { padding: space.lg, paddingBottom: space.xxl },
  listHeader: { paddingBottom: space.md },
  footer: { paddingTop: space.xl, gap: space.lg },
});
