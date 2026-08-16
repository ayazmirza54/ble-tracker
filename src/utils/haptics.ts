import * as Haptics from 'expo-haptics';

import { ProximityLevel } from '@/signal/proximity';

/**
 * Haptics are advisory: a failed pulse must never interrupt tracking, so every
 * call is fire-and-forget.
 */
const safe = (fn: () => Promise<unknown>) => {
  void fn().catch(() => {});
};

export function pulseForLevel(level: ProximityLevel): void {
  switch (level) {
    case 'immediate':
      safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      break;
    case 'close':
      safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      break;
    case 'nearby':
      safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      break;
    case 'far':
      safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      break;
    default:
      safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }
}

export function pulseThresholdCrossed(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export function tap(): void {
  safe(() => Haptics.selectionAsync());
}
