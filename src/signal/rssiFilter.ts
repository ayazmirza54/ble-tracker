/**
 * RSSI smoothing and history.
 *
 * Raw BLE RSSI is noisy: ±6 dBm swings are normal even for a stationary
 * device. Two filters run in parallel:
 *   - EMA  (exponential moving average) for the responsive headline value
 *   - SMA  (simple moving average) over a fixed window, used for trend
 *
 * Nothing here is BLE-specific — it is a pure numeric utility so it can be
 * unit-tested without a radio.
 */

export interface RssiSample {
  rssi: number;
  /** epoch ms */
  t: number;
}

export interface FilterConfig {
  /** EMA weight for the newest sample. 0 = frozen, 1 = no smoothing. */
  alpha: number;
  /** Samples kept for the graph and trend calculation. */
  historySize: number;
}

export const DEFAULT_FILTER: FilterConfig = { alpha: 0.25, historySize: 120 };

export type Trend = 'improving' | 'stable' | 'weakening';

/** dBm change required before a trend is reported as anything but stable. */
const TREND_DEADBAND = 2.5;

export class SignalTracker {
  private samples: RssiSample[] = [];
  private ema: number | null = null;

  constructor(private config: FilterConfig = DEFAULT_FILTER) {}

  push(rssi: number, t: number = Date.now()): void {
    // Guard against the sentinel values some stacks emit for "unknown".
    if (!Number.isFinite(rssi) || rssi === 127 || rssi >= 0) return;

    this.samples.push({ rssi, t });
    if (this.samples.length > this.config.historySize) {
      this.samples.splice(0, this.samples.length - this.config.historySize);
    }

    this.ema =
      this.ema === null
        ? rssi
        : this.config.alpha * rssi + (1 - this.config.alpha) * this.ema;
  }

  reconfigure(config: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  get raw(): number | null {
    const last = this.samples[this.samples.length - 1];
    return last ? last.rssi : null;
  }

  get smoothed(): number | null {
    return this.ema === null ? null : Math.round(this.ema * 10) / 10;
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  get lastSeen(): number {
    const last = this.samples[this.samples.length - 1];
    return last ? last.t : 0;
  }

  history(limit?: number): RssiSample[] {
    if (!limit || limit >= this.samples.length) return [...this.samples];
    return this.samples.slice(this.samples.length - limit);
  }

  /** Mean of the most recent `n` samples, or null if there are none. */
  movingAverage(n = 10): number | null {
    const window = this.history(n);
    if (!window.length) return null;
    return window.reduce((sum, s) => sum + s.rssi, 0) / window.length;
  }

  /**
   * Trend compares the recent window against the window before it. It needs a
   * reasonable number of samples before it will commit to a direction.
   */
  trend(): Trend {
    if (this.samples.length < 8) return 'stable';
    const recent = this.samples.slice(-4);
    const prior = this.samples.slice(-12, -4);
    if (!prior.length) return 'stable';

    const mean = (arr: RssiSample[]) =>
      arr.reduce((s, x) => s + x.rssi, 0) / arr.length;
    const delta = mean(recent) - mean(prior);

    if (delta > TREND_DEADBAND) return 'improving';
    if (delta < -TREND_DEADBAND) return 'weakening';
    return 'stable';
  }
}
