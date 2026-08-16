import { colors } from '@/theme/theme';

export type ProximityLevel =
  | 'immediate'
  | 'close'
  | 'nearby'
  | 'far'
  | 'veryFar'
  | 'lost';

export interface ProximityBand {
  level: ProximityLevel;
  label: string;
  detail: string;
  color: string;
  /** Inclusive lower bound of smoothed RSSI in dBm. */
  minRssi: number;
}

/** Ordered strongest -> weakest. */
export const BANDS: ProximityBand[] = [
  {
    level: 'immediate',
    label: 'Very close',
    detail: 'Within arm’s reach',
    color: colors.immediate,
    minRssi: -55,
  },
  {
    level: 'close',
    label: 'Close',
    detail: 'Same corner of the room',
    color: colors.close,
    minRssi: -67,
  },
  {
    level: 'nearby',
    label: 'Nearby',
    detail: 'Same room, or just outside it',
    color: colors.nearby,
    minRssi: -80,
  },
  {
    level: 'far',
    label: 'Far',
    detail: 'Likely a wall or two away',
    color: colors.far,
    minRssi: -92,
  },
  {
    level: 'veryFar',
    label: 'Very far',
    detail: 'At the edge of range',
    color: colors.veryFar,
    minRssi: -Number.MAX_SAFE_INTEGER,
  },
];

export const LOST_BAND: ProximityBand = {
  level: 'lost',
  label: 'Out of range',
  detail: 'No advertisements received',
  color: colors.lost,
  minRssi: -Number.MAX_SAFE_INTEGER,
};

export function classify(rssi: number | null, isStale = false): ProximityBand {
  if (rssi === null || isStale) return LOST_BAND;
  return BANDS.find((b) => rssi >= b.minRssi) ?? LOST_BAND;
}

/** Normalised 0..1 strength used to drive the meter and bar widths. */
export const RSSI_FLOOR = -100;
export const RSSI_CEIL = -40;

export function strength(rssi: number | null, isStale = false): number {
  if (rssi === null || isStale) return 0;
  const clamped = Math.max(RSSI_FLOOR, Math.min(RSSI_CEIL, rssi));
  return (clamped - RSSI_FLOOR) / (RSSI_CEIL - RSSI_FLOOR);
}
