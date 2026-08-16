import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, mono, radius, space, type } from '@/theme/theme';
import { Button } from '@/components/ui';

interface StateViewProps {
  eyebrow: string;
  title: string;
  body: string;
  tint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Shared frame for every non-content state: loading, empty, denied, off. */
export function StateView({
  eyebrow,
  title,
  body,
  tint = colors.nearby,
  actionLabel,
  onAction,
}: StateViewProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.marker, { borderColor: `${tint}55` }]}>
        <View style={[styles.markerCore, { backgroundColor: tint }]} />
      </View>
      <Text style={[type.label, { color: tint }]}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} tint={tint} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

/** Sweeping bar shown while the radio is warming up or between packets. */
export function ScanningIndicator({ active }: { active: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    progress.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [active, progress]);

  if (!active) return <View style={styles.sweepTrack} />;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 300],
  });

  return (
    <View style={styles.sweepTrack}>
      <Animated.View style={[styles.sweep, { transform: [{ translateX }] }]} />
    </View>
  );
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.disclaimer}>
      <Text style={styles.disclaimerText}>
        Distance is estimated from signal strength, not measured. Walls, bodies,
        pockets, antenna orientation and radio interference all shift the
        reading — treat it as a rough sense of "warmer or colder", not a
        position.
        {compact
          ? ''
          : ' This finds proximity to a transmitting device. It is not GPS and cannot tell you where a device is, only roughly how far.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxl * 2,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  marker: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  markerCore: { width: 8, height: 8, borderRadius: 4 },
  title: { ...type.title, fontSize: 19, textAlign: 'center' },
  body: { ...type.body, textAlign: 'center', maxWidth: 300 },
  action: { marginTop: space.lg, alignSelf: 'stretch' },
  sweepTrack: {
    height: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
    borderRadius: 1,
  },
  sweep: {
    width: 90,
    height: 2,
    backgroundColor: colors.nearby,
    opacity: 0.9,
  },
  disclaimer: {
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    paddingLeft: space.md,
    paddingVertical: space.xs,
  },
  disclaimerText: {
    fontFamily: mono,
    fontSize: 11,
    lineHeight: 17,
    color: colors.textFaint,
  },
});
