/**
 * Best-effort device typing from advertisement data.
 *
 * BLE advertisements do not carry a "device type" field. What we can read is
 * the set of advertised GATT service UUIDs and the manufacturer company ID.
 * Both are hints, not guarantees — many devices advertise neither, and a
 * vendor ID identifies the chipset owner rather than the product. Anything
 * unresolved is reported honestly as unknown rather than guessed.
 */

const SERVICE_HINTS: Record<string, string> = {
  '180d': 'Heart rate monitor',
  '1812': 'Keyboard / mouse / input',
  '180f': 'Battery service',
  '1802': 'Findable tag',
  '1803': 'Findable tag',
  '1819': 'Location & navigation',
  '181a': 'Environmental sensor',
  '1826': 'Fitness machine',
  'fd6f': 'Exposure notification',
  'fe9f': 'Google service',
  'fd5a': 'Tile tracker',
  'feed': 'Tile tracker',
  'fe2c': 'Google Fast Pair',
  'fd44': 'Apple accessory',
  'ffe0': 'Serial module',
};

const COMPANY_IDS: Record<number, string> = {
  0x004c: 'Apple',
  0x0006: 'Microsoft',
  0x0075: 'Samsung',
  0x00e0: 'Google',
  0x0087: 'Garmin',
  0x0157: 'Huawei',
  0x038f: 'Xiaomi',
  0x0171: 'Amazon',
  0x00d2: 'Fitbit',
  0x0059: 'Nordic Semiconductor',
  0x0499: 'Ruuvi',
  0x0118: 'Tile',
  0x0154: 'JBL',
  0x000f: 'Broadcom',
  0x0001: 'Ericsson',
};

export interface DeviceClass {
  /** Human label, or null when nothing could be determined. */
  kind: string | null;
  vendor: string | null;
}

/** Reads the little-endian company ID from base64 manufacturer data. */
export function parseCompanyId(manufacturerData: string | null): number | null {
  if (!manufacturerData) return null;
  try {
    const binary = globalThis.atob
      ? globalThis.atob(manufacturerData)
      : Buffer.from(manufacturerData, 'base64').toString('binary');
    if (binary.length < 2) return null;
    return binary.charCodeAt(0) | (binary.charCodeAt(1) << 8);
  } catch {
    return null;
  }
}

export function classifyDevice(
  serviceUUIDs: string[] | null,
  manufacturerData: string | null,
): DeviceClass {
  let kind: string | null = null;

  for (const uuid of serviceUUIDs ?? []) {
    const short = shortUuid(uuid);
    if (short && SERVICE_HINTS[short]) {
      kind = SERVICE_HINTS[short];
      break;
    }
  }

  const companyId = parseCompanyId(manufacturerData);
  const vendor = companyId !== null ? COMPANY_IDS[companyId] ?? null : null;

  return { kind, vendor };
}

/** Extracts the 16-bit short form from a full 128-bit Bluetooth base UUID. */
function shortUuid(uuid: string): string | null {
  const lower = uuid.toLowerCase();
  if (lower.length === 4) return lower;
  const match = lower.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
  return match ? match[1] : null;
}
