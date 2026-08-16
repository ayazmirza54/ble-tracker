import {
  BleError,
  BleManager,
  Device,
  ScanMode,
  State,
  Subscription,
} from 'react-native-ble-plx';

import { classifyDevice, DeviceClass } from '@/ble/deviceClassifier';
import {
  DEFAULT_FILTER,
  FilterConfig,
  RssiSample,
  SignalTracker,
  Trend,
} from '@/signal/rssiFilter';

/** No advertisement for this long -> the device is treated as stale. */
export const STALE_AFTER_MS = 8_000;
/** Stale for this long -> dropped from the list entirely (unless pinned). */
export const PRUNE_AFTER_MS = 45_000;
/** UI notification rate. Advertisements can arrive far faster than 60fps. */
const EMIT_INTERVAL_MS = 250;

export interface TrackedDevice {
  /**
   * Platform device identifier. On Android this is the MAC address; on iOS it
   * is an opaque per-app UUID that CoreBluetooth rotates — never treat it as a
   * hardware address.
   */
  id: string;
  /** Advertised name, or null when the device does not broadcast one. */
  name: string | null;
  localName: string | null;
  rssi: number | null;
  smoothedRssi: number | null;
  trend: Trend;
  txPowerLevel: number | null;
  serviceUUIDs: string[];
  deviceClass: DeviceClass;
  isConnectable: boolean | null;
  firstSeen: number;
  lastSeen: number;
  isStale: boolean;
  sampleCount: number;
  history: RssiSample[];
}

export type ScannerStatus =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'poweredOff'
  | 'unauthorized'
  | 'unsupported'
  | 'error';

export interface ScannerSnapshot {
  status: ScannerStatus;
  bluetoothState: State;
  devices: TrackedDevice[];
  error: string | null;
  lastUpdate: number;
}

type Listener = (snapshot: ScannerSnapshot) => void;

interface DeviceRecord {
  device: Device;
  tracker: SignalTracker;
  firstSeen: number;
}

/**
 * Owns the radio. Everything above this layer consumes immutable snapshots and
 * never touches react-native-ble-plx directly, which keeps scanning, signal
 * processing and presentation independently testable.
 */
export class BleScanner {
  private manager: BleManager | null = null;
  private records = new Map<string, DeviceRecord>();
  private listeners = new Set<Listener>();
  private stateSubscription: Subscription | null = null;
  private emitTimer: ReturnType<typeof setInterval> | null = null;

  private status: ScannerStatus = 'idle';
  private bluetoothState: State = State.Unknown;
  private error: string | null = null;
  private dirty = false;
  /** Device ids kept alive past PRUNE_AFTER_MS (the one being tracked). */
  private pinned = new Set<string>();
  private filterConfig: FilterConfig = DEFAULT_FILTER;

  // --- lifecycle ---------------------------------------------------------

  private ensureManager(): BleManager {
    if (!this.manager) {
      this.manager = new BleManager();
      this.stateSubscription = this.manager.onStateChange((state) => {
        this.bluetoothState = state;
        this.handleStateChange(state);
      }, true);
    }
    return this.manager;
  }

  async start(): Promise<void> {
    const manager = this.ensureManager();
    if (this.status === 'scanning' || this.status === 'starting') return;

    this.setStatus('starting');
    const state = await manager.state();
    this.bluetoothState = state;

    if (state !== State.PoweredOn) {
      this.handleStateChange(state);
      return;
    }
    this.beginScan();
  }

  private beginScan(): void {
    const manager = this.ensureManager();
    this.error = null;

    manager.startDeviceScan(
      null,
      // allowDuplicates is what makes continuous RSSI updates possible; without
      // it iOS reports each device exactly once per scan session.
      { allowDuplicates: true, scanMode: ScanMode.LowLatency },
      (error, device) => {
        if (error) {
          this.handleScanError(error);
          return;
        }
        if (device) this.ingest(device);
      },
    );

    this.setStatus('scanning');
    this.startEmitLoop();
  }

  stop(): void {
    this.manager?.stopDeviceScan();
    this.stopEmitLoop();
    if (this.status === 'scanning' || this.status === 'starting') {
      this.setStatus('idle');
    }
  }

  /** Full teardown. Call when the app is unmounted. */
  destroy(): void {
    this.stop();
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.manager?.destroy();
    this.manager = null;
    this.records.clear();
    this.listeners.clear();
  }

  clear(): void {
    for (const [id] of this.records) {
      if (!this.pinned.has(id)) this.records.delete(id);
    }
    this.dirty = true;
    this.emit();
  }

  // --- configuration -----------------------------------------------------

  setFilterConfig(config: FilterConfig): void {
    this.filterConfig = config;
    for (const record of this.records.values()) {
      record.tracker.reconfigure(config);
    }
  }

  pin(id: string | null): void {
    this.pinned.clear();
    if (id) this.pinned.add(id);
  }

  // --- ingestion ---------------------------------------------------------

  private ingest(device: Device): void {
    const now = Date.now();
    let record = this.records.get(device.id);

    if (!record) {
      record = {
        device,
        tracker: new SignalTracker(this.filterConfig),
        firstSeen: now,
      };
      this.records.set(device.id, record);
    } else {
      // Later advertisements can carry fields the first one lacked (scan
      // response packets in particular often hold the name).
      record.device = device;
    }

    if (typeof device.rssi === 'number') {
      record.tracker.push(device.rssi, now);
    }
    this.dirty = true;
  }

  // --- state handling ----------------------------------------------------

  private handleStateChange(state: State): void {
    switch (state) {
      case State.PoweredOn:
        if (this.status !== 'scanning') this.beginScan();
        break;
      case State.PoweredOff:
        this.manager?.stopDeviceScan();
        this.stopEmitLoop();
        this.setStatus('poweredOff');
        break;
      case State.Unauthorized:
        this.setStatus('unauthorized');
        break;
      case State.Unsupported:
        this.setStatus('unsupported');
        break;
      default:
        this.emit(true);
    }
  }

  private handleScanError(error: BleError): void {
    this.error = error.message ?? 'Scan failed';
    this.manager?.stopDeviceScan();
    this.stopEmitLoop();
    this.setStatus(
      error.message?.toLowerCase().includes('permission')
        ? 'unauthorized'
        : 'error',
    );
  }

  private setStatus(status: ScannerStatus): void {
    this.status = status;
    this.emit(true);
  }

  // --- emission ----------------------------------------------------------

  private startEmitLoop(): void {
    if (this.emitTimer) return;
    this.emitTimer = setInterval(() => {
      this.pruneStale();
      if (this.dirty) this.emit(true);
    }, EMIT_INTERVAL_MS);
  }

  private stopEmitLoop(): void {
    if (this.emitTimer) clearInterval(this.emitTimer);
    this.emitTimer = null;
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [id, record] of this.records) {
      if (this.pinned.has(id)) continue;
      if (now - record.tracker.lastSeen > PRUNE_AFTER_MS) {
        this.records.delete(id);
        this.dirty = true;
      }
    }
    // Staleness flips without new packets arriving, so the UI still needs a tick.
    if (this.records.size) this.dirty = true;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit(force = false): void {
    if (!force && !this.dirty) return;
    this.dirty = false;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  snapshot(): ScannerSnapshot {
    const now = Date.now();
    const devices: TrackedDevice[] = [];

    for (const [id, record] of this.records) {
      const { device, tracker } = record;
      const lastSeen = tracker.lastSeen || record.firstSeen;
      const isStale = now - lastSeen > STALE_AFTER_MS;

      devices.push({
        id,
        name: device.name ?? null,
        localName: device.localName ?? null,
        rssi: tracker.raw,
        smoothedRssi: tracker.smoothed,
        trend: tracker.trend(),
        txPowerLevel: device.txPowerLevel ?? null,
        serviceUUIDs: device.serviceUUIDs ?? [],
        deviceClass: classifyDevice(
          device.serviceUUIDs ?? null,
          device.manufacturerData ?? null,
        ),
        isConnectable: device.isConnectable ?? null,
        firstSeen: record.firstSeen,
        lastSeen,
        isStale,
        sampleCount: tracker.sampleCount,
        history: tracker.history(120),
      });
    }

    // Strongest first; stale devices always sink to the bottom.
    devices.sort((a, b) => {
      if (a.isStale !== b.isStale) return a.isStale ? 1 : -1;
      return (b.smoothedRssi ?? -999) - (a.smoothedRssi ?? -999);
    });

    return {
      status: this.status,
      bluetoothState: this.bluetoothState,
      devices,
      error: this.error,
      lastUpdate: now,
    };
  }
}
