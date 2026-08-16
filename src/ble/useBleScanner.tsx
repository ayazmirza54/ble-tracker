import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { State } from 'react-native-ble-plx';

import { BleScanner, ScannerSnapshot, TrackedDevice } from '@/ble/BleScanner';
import {
  PermissionStatus,
  requestBlePermissions,
} from '@/ble/permissions';
import { useSettings } from '@/storage/SettingsContext';

interface ScannerContextValue extends ScannerSnapshot {
  permission: PermissionStatus | null;
  isReady: boolean;
  requestAccess: () => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => void;
  clearDevices: () => void;
  pinDevice: (id: string | null) => void;
  deviceById: (id: string) => TrackedDevice | undefined;
}

const ScannerContext = createContext<ScannerContextValue | null>(null);

const EMPTY: ScannerSnapshot = {
  status: 'idle',
  bluetoothState: State.Unknown,
  devices: [],
  error: null,
  lastUpdate: 0,
};

export function ScannerProvider({ children }: { children: React.ReactNode }) {
  const scannerRef = useRef<BleScanner>();
  if (!scannerRef.current) scannerRef.current = new BleScanner();
  const scanner = scannerRef.current;

  const { settings } = useSettings();
  const [snapshot, setSnapshot] = useState<ScannerSnapshot>(EMPTY);
  const [permission, setPermission] = useState<PermissionStatus | null>(null);

  useEffect(() => scanner.subscribe(setSnapshot), [scanner]);
  useEffect(() => () => scanner.destroy(), [scanner]);

  useEffect(() => {
    scanner.setFilterConfig(settings.filter);
  }, [scanner, settings.filter]);

  const startScan = useCallback(async () => {
    const status = permission ?? (await requestBlePermissions());
    setPermission(status);
    if (status !== 'granted') return;
    await scanner.start();
  }, [permission, scanner]);

  const requestAccess = useCallback(async () => {
    const status = await requestBlePermissions();
    setPermission(status);
    if (status === 'granted') await scanner.start();
  }, [scanner]);

  // Ask once on mount, then start scanning as soon as we are allowed to.
  useEffect(() => {
    void requestAccess();
  }, [requestAccess]);

  // iOS and Android both throttle or suspend scans in the background. Rather
  // than pretend otherwise, stop cleanly on background and resume on return.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void scanner.start();
      } else {
        scanner.stop();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [scanner]);

  const value = useMemo<ScannerContextValue>(
    () => ({
      ...snapshot,
      permission,
      isReady: snapshot.status === 'scanning',
      requestAccess,
      startScan,
      stopScan: () => scanner.stop(),
      clearDevices: () => scanner.clear(),
      pinDevice: (id) => scanner.pin(id),
      deviceById: (id) => snapshot.devices.find((d) => d.id === id),
    }),
    [snapshot, permission, requestAccess, startScan, scanner],
  );

  return (
    <ScannerContext.Provider value={value}>{children}</ScannerContext.Provider>
  );
}

export function useScanner(): ScannerContextValue {
  const ctx = useContext(ScannerContext);
  if (!ctx) throw new Error('useScanner must be used inside a ScannerProvider');
  return ctx;
}

/** Subscribes to a single device, re-rendering only on its updates. */
export function useTrackedDevice(id: string): TrackedDevice | undefined {
  const { devices } = useScanner();
  return useMemo(() => devices.find((d) => d.id === id), [devices, id]);
}
