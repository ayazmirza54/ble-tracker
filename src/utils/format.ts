import { TrackedDevice } from '@/ble/BleScanner';
import { Trend } from '@/signal/rssiFilter';

/** Falls back through advertised name -> scan-response name -> shortened id. */
export function displayName(
  device: Pick<TrackedDevice, 'id' | 'name' | 'localName'>,
  alias?: string,
): string {
  if (alias) return alias;
  if (device.name?.trim()) return device.name.trim();
  if (device.localName?.trim()) return device.localName.trim();
  return 'Unnamed device';
}

export function hasAdvertisedName(
  device: Pick<TrackedDevice, 'name' | 'localName'>,
): boolean {
  return Boolean(device.name?.trim() || device.localName?.trim());
}

/** Keeps long iOS UUIDs readable without hiding that they are identifiers. */
export function shortId(id: string): string {
  if (id.length <= 17) return id.toUpperCase();
  return `${id.slice(0, 8)}…${id.slice(-4)}`.toUpperCase();
}

export function trendLabel(trend: Trend): string {
  switch (trend) {
    case 'improving':
      return 'Getting closer';
    case 'weakening':
      return 'Getting weaker';
    default:
      return 'Holding steady';
  }
}

export function trendGlyph(trend: Trend): string {
  return trend === 'improving' ? '▲' : trend === 'weakening' ? '▼' : '■';
}

export function secondsAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 1) return 'now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}
