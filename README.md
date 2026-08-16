# Proximis — BLE proximity tracker

A React Native (Expo prebuild) app that scans for real Bluetooth Low Energy
advertisements, smooths the RSSI, and turns it into a proximity reading you can
walk toward. No simulated devices, no synthetic signal values: if the radio
reports nothing, the UI says so.

---

## Run it

```bash
npm install
npx expo prebuild          # generates ios/ and android/
npx expo run:android       # or: npx expo run:ios  (device, not simulator)
```

**This will not run in Expo Go or the iOS simulator.** `react-native-ble-plx`
is a native module, and neither the simulator nor a Bluetooth-less emulator has
a BLE radio. Use a physical device.

---

## Architecture

Four layers, each independently replaceable and testable:

| Layer | Location | Responsibility |
|---|---|---|
| Radio | `src/ble/BleScanner.ts` | Owns `BleManager`, scan lifecycle, adapter state, device registry, staleness/pruning, throttled snapshot emission |
| Signal | `src/signal/rssiFilter.ts` | EMA + moving average + history ring buffer + trend. Pure numbers, no BLE imports |
| Model | `src/signal/distance.ts`, `proximity.ts` | Path-loss distance estimate, calibration solver, proximity banding |
| Presentation | `src/components/`, `src/screens/` | Consumes immutable snapshots via React context. Never touches the BLE library |

`src/ble/useBleScanner.tsx` is the only bridge between the radio and React. It
subscribes to `BleScanner` snapshots, handles permissions, and stops the scan
when the app backgrounds.

### Signal processing

- **EMA** (`alpha` default `0.25`) drives every displayed value. Raw RSSI is
  shown alongside it so the smoothing is never hidden.
- **Trend** compares the mean of the last 4 samples against the previous 8, with
  a 2.5 dBm deadband so noise doesn't read as movement.
- **Distance** uses the log-distance path-loss model
  `d = 10^((measuredPower − RSSI) / (10n))`, with both parameters editable in
  the Calibration screen. `-59 dBm @ n=2.7` yields exactly 1.00 m; capture a
  live reading at 1 m to solve `measuredPower` for a specific device.
- Sentinel values (`127`, `>= 0`) are discarded rather than charted.

---

## Platform limitations, handled honestly

These are constraints of the operating systems, not gaps in the app. The UI
adapts to each rather than pretending it works.

**Identifiers, not MAC addresses.** On Android the device id is the MAC. On iOS
CoreBluetooth returns an opaque, per-app UUID that rotates — the app never
labels it as a hardware address, and local names you assign are keyed to
whatever id the platform gave. If iOS rotates the identifier, the device
reappears as a new entry. That is unavoidable from a third-party app.

**Background scanning is restricted.** iOS heavily throttles background scanning
and requires a service-UUID filter for it; Android 8+ throttles unfiltered
background scans. The app therefore stops cleanly on background and resumes on
foreground instead of claiming continuous tracking it cannot deliver. The iOS
`bluetooth-central` background mode is declared for the scaffolding, but expect
the useful experience to be foreground.

**Permissions.** Android 12+ requests `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`;
below API 31 a BLE scan legally counts as location access, so
`ACCESS_FINE_LOCATION` is requested instead. iOS raises its own prompt when the
central manager powers on. Denied, permanently-blocked, powered-off and
unsupported states each have their own screen with a route to system settings.

**Unnamed devices.** Most BLE peripherals never broadcast a name. Those show as
"Unnamed device" with their identifier, and can be renamed locally — the alias
is stored on-device in AsyncStorage and never leaves it.

**Device type is a hint.** BLE has no device-type field. `deviceClassifier.ts`
infers from advertised GATT service UUIDs and the manufacturer company ID.
Unresolved devices are reported as unknown rather than guessed at.

**This is not positioning.** RSSI gives a rough, noisy sense of distance along
one axis and nothing about direction. Walls, bodies, pockets, metal, antenna
orientation and 2.4 GHz interference all move the reading by several metres'
worth of dBm. It answers "warmer or colder", not "where". The disclaimer is
present on both the scan and tracking screens.

---

## Screens

- **Scan** — live list sorted strongest-first, stale devices sunk to the bottom
  and flagged. Cards show name, identifier, smoothed RSSI, estimated distance,
  trend arrow, inferred type/vendor, and connectable vs broadcast-only status.
- **Track** — segmented sonar dial whose lit arc and pulse rate both scale with
  signal strength, plus smoothed RSSI, raw RSSI, trend, live RSSI graph with the
  haptic threshold marked, full advertisement dump, and local rename.
- **Calibration** — reference power (manual or captured at 1 m), environment
  preset, EMA weight, haptic toggles and threshold, and a live preview table of
  how the current model maps dBm to metres.

## Design notes

Dark instrument-panel treatment. Signal strength rides a single physical colour
ramp — deep blue (far) → cyan → mint → hot lime (very close) — so colour alone
communicates proximity before any number is read. All telemetry is set in a
monospaced face; labels are spaced uppercase micro-type. The signature element
is the segmented dial: 44 discrete ticks illuminating in sequence, reading as an
instrument rather than a progress bar, with a pulse ring that quickens as you
close in.

Accessibility: the meter exposes `progressbar` role with value, cards carry
descriptive labels, and every colour cue is paired with a text label so the
palette is never the only channel.
