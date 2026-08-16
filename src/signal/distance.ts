/**
 * RSSI -> distance via the log-distance path-loss model.
 *
 *   d = 10 ^ ((measuredPower - RSSI) / (10 * n))
 *
 * `measuredPower` is the RSSI observed at exactly 1 m from the device, and `n`
 * is the environmental path-loss exponent (~2.0 free space, 2.7-3.5 indoors
 * with furniture, 4+ through walls). Both are configurable because the correct
 * values differ per device model and per room — see CalibrationScreen.
 *
 * The output is an ORDER-OF-MAGNITUDE ESTIMATE, not a position fix.
 */

export interface PathLossConfig {
  /** RSSI in dBm measured 1 m from the device. */
  measuredPower: number;
  /** Path-loss exponent. */
  environmentalFactor: number;
}

export const DEFAULT_PATH_LOSS: PathLossConfig = {
  measuredPower: -59,
  environmentalFactor: 2.7,
};

export const ENVIRONMENT_PRESETS: Array<{
  key: string;
  label: string;
  hint: string;
  environmentalFactor: number;
}> = [
  { key: 'open', label: 'Open space', hint: 'Line of sight, few obstacles', environmentalFactor: 2.0 },
  { key: 'room', label: 'Single room', hint: 'Furniture, some bodies', environmentalFactor: 2.7 },
  { key: 'home', label: 'Home / office', hint: 'Interior walls between rooms', environmentalFactor: 3.3 },
  { key: 'dense', label: 'Dense build', hint: 'Thick walls, metal, clutter', environmentalFactor: 4.0 },
];

/** Distance in metres, or null when there is no usable RSSI. */
export function estimateDistance(
  rssi: number | null,
  config: PathLossConfig = DEFAULT_PATH_LOSS,
): number | null {
  if (rssi === null || !Number.isFinite(rssi) || rssi >= 0) return null;

  const exponent = (config.measuredPower - rssi) / (10 * config.environmentalFactor);
  const metres = Math.pow(10, exponent);
  if (!Number.isFinite(metres)) return null;

  return Math.min(metres, 200);
}

/**
 * Confidence band. The model's error grows quickly with distance, so anything
 * past a few metres is reported as a range rather than a figure.
 */
export function distanceRange(
  metres: number | null,
): { low: number; high: number } | null {
  if (metres === null) return null;
  const spread = metres < 1 ? 0.35 : metres < 5 ? 0.5 : 0.7;
  return { low: metres * (1 - spread), high: metres * (1 + spread) };
}

export function formatDistance(metres: number | null): string {
  if (metres === null) return '--';
  if (metres < 1) return `${Math.round(metres * 100)} cm`;
  if (metres < 10) return `${metres.toFixed(1)} m`;
  if (metres < 100) return `${Math.round(metres)} m`;
  return '100+ m';
}

/**
 * Solve for `measuredPower` given a known reference distance. Used by the
 * calibration flow: hold the phone 1 m away and capture the smoothed RSSI.
 */
export function calibrateMeasuredPower(
  observedRssi: number,
  atMetres: number,
  environmentalFactor: number,
): number {
  return observedRssi + 10 * environmentalFactor * Math.log10(atMetres);
}
