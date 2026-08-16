import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius, space, type } from '@/theme/theme';

export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={type.label}>{children}</Text>;
}

export function Pill({
  children,
  color = colors.textMuted,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <View style={[styles.pill, { borderColor: `${color}55` }]}>
      <Text style={[styles.pillText, { color }]}>{children}</Text>
    </View>
  );
}

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'ghost';
  tint?: string;
}

export function Button({
  title,
  variant = 'primary',
  tint = colors.nearby,
  style,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'primary'
          ? { backgroundColor: `${tint}1F`, borderColor: `${tint}77` }
          : { borderColor: colors.border },
        pressed && styles.buttonPressed,
        style as ViewStyle,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.buttonText,
          { color: variant === 'primary' ? tint : colors.textMuted },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** Horizontal strength bar used on device cards. */
export function StrengthBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.round(value * 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  pillText: { fontSize: 10, letterSpacing: 0.8, fontWeight: '600' },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6 },
  barTrack: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
});
