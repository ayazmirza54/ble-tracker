import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DEFAULT_PATH_LOSS, PathLossConfig } from '@/signal/distance';
import { DEFAULT_FILTER, FilterConfig } from '@/signal/rssiFilter';

const STORAGE_KEY = 'proximis.settings.v1';

export interface Settings {
  pathLoss: PathLossConfig;
  filter: FilterConfig;
  haptics: {
    enabled: boolean;
    /** Buzz whenever the smoothed RSSI crosses this many dBm. */
    thresholdDbm: number;
    /** Buzz on every proximity band change. */
    onBandChange: boolean;
  };
  /** Locally chosen names, keyed by platform device id. */
  aliases: Record<string, string>;
}

const DEFAULT_SETTINGS: Settings = {
  pathLoss: DEFAULT_PATH_LOSS,
  filter: DEFAULT_FILTER,
  haptics: { enabled: true, thresholdDbm: -60, onBandChange: true },
  aliases: {},
};

interface SettingsContextValue {
  settings: Settings;
  hydrated: boolean;
  update: (patch: Partial<Settings>) => void;
  setAlias: (id: string, alias: string | null) => void;
  resetCalibration: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          pathLoss: { ...prev.pathLoss, ...parsed.pathLoss },
          filter: { ...prev.filter, ...parsed.filter },
          haptics: { ...prev.haptics, ...parsed.haptics },
          aliases: { ...prev.aliases, ...parsed.aliases },
        }));
      })
      .catch(() => {
        /* corrupt or unavailable storage falls back to defaults */
      })
      .finally(() => !cancelled && setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: Settings) => {
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      }),
    [],
  );

  const setAlias = useCallback(
    (id: string, alias: string | null) =>
      setSettings((prev) => {
        const aliases = { ...prev.aliases };
        if (alias && alias.trim()) aliases[id] = alias.trim();
        else delete aliases[id];
        const next = { ...prev, aliases };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      }),
    [],
  );

  const resetCalibration = useCallback(
    () => update({ pathLoss: DEFAULT_PATH_LOSS, filter: DEFAULT_FILTER }),
    [update],
  );

  const value = useMemo(
    () => ({ settings, hydrated, update, setAlias, resetCalibration }),
    [settings, hydrated, update, setAlias, resetCalibration],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside a SettingsProvider');
  return ctx;
}
