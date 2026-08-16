import { Platform } from 'react-native';

/**
 * Instrument-panel palette. Signal strength is encoded on a single physical
 * ramp — deep blue (weak) through cyan and mint to hot lime (very close) —
 * so the colour alone communicates proximity before any number is read.
 */
export const colors = {
  bg: '#060910',
  surface: '#0E1421',
  surfaceRaised: '#151D2E',
  border: '#1E2A40',
  borderStrong: '#2C3B57',

  text: '#E8EEF7',
  textMuted: '#7C8AA5',
  textFaint: '#4C5A73',

  immediate: '#9BFF6B',
  close: '#3DF5B8',
  nearby: '#22D3EE',
  far: '#4F7CF7',
  veryFar: '#5A6A88',
  lost: '#556074',

  warn: '#F5A524',
  danger: '#FF6B6B',
} as const;

export const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

export const type = {
  /** Uppercase micro-label used for panel captions. */
  label: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '600' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
  },
  readout: { fontFamily: mono, fontSize: 28, color: colors.text },
  readoutSmall: { fontFamily: mono, fontSize: 15, color: colors.text },
  title: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };
