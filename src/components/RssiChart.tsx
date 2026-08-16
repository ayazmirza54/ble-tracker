import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { RssiSample } from '@/signal/rssiFilter';
import { colors, mono, space, type } from '@/theme/theme';

const FLOOR = -100;
const CEIL = -35;

interface Props {
  samples: RssiSample[];
  color: string;
  height?: number;
  width: number;
  /** Optional dBm level to mark, e.g. the haptic threshold. */
  markerDbm?: number | null;
}

/** Live RSSI trace. Newest sample sits at the right edge. */
export function RssiChart({
  samples,
  color,
  height = 132,
  width,
  markerDbm = null,
}: Props) {
  const { line, area, latestY } = useMemo(() => {
    if (samples.length < 2) return { line: '', area: '', latestY: null };

    const points = samples.slice(-90);
    const stepX = width / Math.max(1, points.length - 1);
    const toY = (rssi: number) => {
      const clamped = Math.max(FLOOR, Math.min(CEIL, rssi));
      return height - ((clamped - FLOOR) / (CEIL - FLOOR)) * height;
    };

    const coords = points.map((s, i) => ({ x: i * stepX, y: toY(s.rssi) }));
    const line = coords
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;

    return { line, area, latestY: coords[coords.length - 1].y };
  }, [samples, width, height]);

  const markerY =
    markerDbm === null
      ? null
      : height -
        ((Math.max(FLOOR, Math.min(CEIL, markerDbm)) - FLOOR) / (CEIL - FLOOR)) *
          height;

  if (samples.length < 2) {
    return (
      <View style={[styles.empty, { height, width }]}>
        <Text style={styles.emptyText}>Collecting samples…</Text>
      </View>
    );
  }

  return (
    <View style={{ width }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={0}
            y1={height * f}
            x2={width}
            y2={height * f}
            stroke={colors.border}
            strokeWidth={StyleSheet.hairlineWidth}
          />
        ))}

        {markerY !== null && (
          <Line
            x1={0}
            y1={markerY}
            x2={width}
            y2={markerY}
            stroke={colors.warn}
            strokeOpacity={0.6}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        <Path d={area} fill="url(#fill)" />
        <Path
          d={line}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {latestY !== null && (
          <Line
            x1={width - 1}
            y1={latestY}
            x2={width}
            y2={latestY}
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
          />
        )}
      </Svg>

      <View style={styles.axis}>
        <Text style={styles.axisText}>{CEIL} dBm</Text>
        <Text style={type.label}>last {Math.min(samples.length, 90)} samples</Text>
        <Text style={styles.axisText}>{FLOOR} dBm</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  emptyText: { fontFamily: mono, fontSize: 12, color: colors.textFaint },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  axisText: { fontFamily: mono, fontSize: 10, color: colors.textFaint },
});
