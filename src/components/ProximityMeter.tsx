import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { ProximityBand } from '@/signal/proximity';
import { colors, mono, space, type } from '@/theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SEGMENTS = 44;
const SWEEP = 260; // degrees of arc covered by the dial
const START_ANGLE = 140;

interface Props {
  /** 0..1 normalised signal strength. */
  strength: number;
  band: ProximityBand;
  /** Large centre readout, e.g. "1.4 m". */
  primary: string;
  secondary: string;
  size?: number;
  isLost?: boolean;
}

/**
 * Signature element: a segmented sonar dial. Discrete ticks illuminate up to
 * the current strength — an instrument reading rather than a smooth gauge — and
 * a pulse ring expands at a rate that quickens as the device gets closer.
 */
export function ProximityMeter({
  strength,
  band,
  primary,
  secondary,
  size = 260,
  isLost = false,
}: Props) {
  const litCount = Math.round(strength * SEGMENTS);
  const radius = size / 2 - 26;
  const centre = size / 2;

  const pulse = useRef(new Animated.Value(0)).current;
  const litAnim = useRef(new Animated.Value(0)).current;

  // Faster pulse = stronger signal. Stops entirely when the device is lost.
  const period = useMemo(
    () => 2400 - Math.round(strength * 1700),
    [strength],
  );

  useEffect(() => {
    if (isLost) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: period,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [pulse, period, isLost]);

  useEffect(() => {
    Animated.timing(litAnim, {
      toValue: litCount,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [litAnim, litCount]);

  const pulseRadius = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [radius * 0.35, radius * 0.98],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.45, 0],
  });

  const ticks = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => {
        const angle = START_ANGLE + (SWEEP / (SEGMENTS - 1)) * i;
        const rad = (angle * Math.PI) / 180;
        const inner = radius - 14;
        return {
          i,
          x1: centre + Math.cos(rad) * inner,
          y1: centre + Math.sin(rad) * inner,
          x2: centre + Math.cos(rad) * radius,
          y2: centre + Math.sin(rad) * radius,
        };
      }),
    [centre, radius],
  );

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`${band.label}. ${primary}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(strength * 100) }}
    >
      <Svg width={size} height={size}>
        <G>
          <Circle
            cx={centre}
            cy={centre}
            r={radius - 26}
            stroke={colors.border}
            strokeWidth={StyleSheet.hairlineWidth}
            fill="none"
          />
          {!isLost && (
            <AnimatedCircle
              cx={centre}
              cy={centre}
              r={pulseRadius as unknown as number}
              stroke={band.color}
              strokeOpacity={pulseOpacity as unknown as number}
              strokeWidth={2}
              fill="none"
            />
          )}
          {ticks.map((tick) => {
            const lit = tick.i < litCount;
            return (
              <Line
                key={tick.i}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={lit ? band.color : colors.border}
                strokeOpacity={lit ? 1 : 0.55}
                strokeWidth={lit ? 3.5 : 2}
                strokeLinecap="round"
              />
            );
          })}
        </G>
      </Svg>

      <View style={styles.centre} pointerEvents="none">
        <Text style={[type.label, { color: band.color }]}>{band.label}</Text>
        <Text style={[styles.primary, { color: isLost ? colors.textFaint : colors.text }]}>
          {primary}
        </Text>
        <Text style={styles.secondary}>{secondary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  centre: { position: 'absolute', alignItems: 'center', gap: space.xs },
  primary: { fontFamily: mono, fontSize: 42, letterSpacing: -1 },
  secondary: { fontFamily: mono, fontSize: 12, color: colors.textMuted },
});
