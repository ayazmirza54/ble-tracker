import { PermissionsAndroid, Platform } from 'react-native';

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

/**
 * Android 12 (API 31) split Bluetooth out of the location permission group.
 * Below 31 a BLE scan legally counts as location access and FINE_LOCATION is
 * mandatory; from 31 up we request BLUETOOTH_SCAN / BLUETOOTH_CONNECT instead.
 * iOS has no runtime request here — the system prompt is raised by CoreBluetooth
 * the first time the central manager powers on.
 */
export async function requestBlePermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'granted';

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;

  const required =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  try {
    const result = await PermissionsAndroid.requestMultiple(required);
    const values = Object.values(result);

    if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) {
      return 'granted';
    }
    if (values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
      return 'blocked';
    }
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

export function permissionExplanation(status: PermissionStatus): string {
  switch (status) {
    case 'blocked':
      return 'Bluetooth access was permanently declined. Enable it in Settings to scan for devices.';
    case 'denied':
      return 'Scanning needs Bluetooth permission. Grant it to see nearby devices.';
    case 'unavailable':
      return 'This device did not report a usable Bluetooth permission state.';
    default:
      return '';
  }
}
