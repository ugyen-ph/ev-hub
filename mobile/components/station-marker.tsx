// Custom map pin used for every station: a miniature "EV CHARGING STATION"
// road sign (rounded portrait sign, white emblem: a ring broken into a "G"
// whose crossbar is an EV plug with a lightning-bolt cut-out, over two white
// "text" bars) instead of Google's default teardrop pin. Availability recolors
// the sign: green = free chargers, red = all taken, blue = selected. Every pin
// sits in a colour-tinted glow aura and "breathes" - a slow sine pulse of the
// Marker's native `opacity`, which never triggers a re-rasterisation, so a map
// full of glowing pins costs the same as static ones. The badge view itself is
// rasterised into the marker icon once (tracksViewChanges flips off right
// after mount).

import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Marker } from 'react-native-maps';
import Svg, { Path, Rect } from 'react-native-svg';

// --- The breathing glow ------------------------------------------------------

/** One full breathe (dim -> bright -> dim), in milliseconds. */
const CYCLE_MS = 3000;
/** Phase step (~8 ticks/s reads as buttery at pin size, near-zero cost). */
const STEP_MS = 120;
/** Shared clock base so every pin on the map breathes in unison. */
const T0 = Date.now();

/** hex (#RGB / #RRGGBB) + alpha -> rgba(); unparsable colours stay invisible. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgba(0, 0, 0, 0)';
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Soft, colour-tinted aura behind a badge: two concentric rounded rings at
 * decreasing alpha, each centred in its own absolute-fill layer (the parent
 * must be a positioned container). Static by design - it is baked into the
 * marker icon once, so it costs nothing at runtime.
 */
function Glow({
  color,
  width,
  height,
  radius,
  strong = false,
}: {
  color: string;
  width: number;
  height: number;
  radius: number;
  strong?: boolean;
}) {
  const g1 = width < 18 ? 4 : 12;
  const g2 = width < 18 ? 8 : 23;
  return (
    <>
      <View style={styles.glowLayer} pointerEvents="none">
        <View
          style={[
            styles.glowRing,
            {
              width: width + g2 * 2,
              height: height + g2 * 2,
              borderRadius: radius + g2 / 2,
              backgroundColor: withAlpha(color, strong ? 0.16 : 0.09),
            },
          ]}
        />
      </View>
      <View style={styles.glowLayer} pointerEvents="none">
        <View
          style={[
            styles.glowRing,
            {
              width: width + g1 * 2,
              height: height + g1 * 2,
              borderRadius: radius + g1 / 2,
              backgroundColor: withAlpha(color, strong ? 0.3 : 0.17),
            },
          ]}
        />
      </View>
    </>
  );
}

/** White emblem (G-ring + EV plug + bolt cut-out) on an 88x88 design grid. */
function Emblem({ width, color }: { width: number; color: string }) {
  return (
    <Svg width={width} height={width} viewBox="4 4 88 88">
      {/* Ring, broken on the upper right so the crossbar reads as a "G". */}
      <Path
        d="M 84 48 A 36 36 0 1 1 71.1 20.4"
        stroke="#FFFFFF"
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
      {/* Crossbar cable from the ring's 3 o'clock end to the plug body. */}
      <Rect x={50} y={44.2} width={32} height={7.6} rx={3.8} fill="#FFFFFF" />
      {/* Plug body + two prongs pointing left. */}
      <Rect x={32} y={39} width={22} height={18} rx={6} fill="#FFFFFF" />
      <Rect x={24} y={42.4} width={8} height={4.6} rx={1.6} fill="#FFFFFF" />
      <Rect x={24} y={49} width={8} height={4.6} rx={1.6} fill="#FFFFFF" />
      {/* Lightning bolt cut-out: the sign colour shows through the plug. */}
      <Path d="M46 40.5 L35.5 50.5 L41 50.5 L39 55.8 L50 45.2 L44.3 45.2 Z" fill={color} />
    </Svg>
  );
}

/**
 * The sign itself - usable standalone (legend) or inside a Marker. `color` is
 * the sign background; emblem and bars stay white. Below `width` 18 the text
 * bars are dropped (illegible) and only the emblem shows. `glow` adds the
 * colour aura (compact pads below width 18 so the legend row stays small).
 */
export function StationSignView({
  color,
  width,
  selected = false,
  glow = true,
}: {
  color: string;
  width: number;
  selected?: boolean;
  glow?: boolean;
}) {
  const h = Math.round(width * (selected ? 1.24 : 1.29));
  const k = width / 28;
  const showBars = width >= 18;
  const sign = (
    <View
      style={[
        styles.sign,
        {
          width,
          height: h,
          backgroundColor: color,
          borderRadius: 6 * k,
          borderWidth: 1.6 * k,
          paddingTop: 3.4 * k,
          shadowColor: color,
        },
      ]}>
      <Emblem width={width * 0.71} color={color} />
      {showBars ? (
        <View style={[styles.bars, { bottom: 3 * k, gap: 2 * k }]}>
          <View style={[styles.bar, { width: width * 0.6, height: 2.3 * k }]} />
          <View style={[styles.bar, { width: width * 0.4, height: 2.3 * k }]} />
        </View>
      ) : null}
    </View>
  );
  if (!glow) return sign;
  const g2 = width < 18 ? 8 : 23;
  return (
    <View style={[styles.glowBox, { width: width + g2 * 2, height: h + g2 * 2 }]}>
      <Glow color={color} width={width} height={h} radius={6 * k} strong={selected} />
      {sign}
    </View>
  );
}

type Props = {
  latitude: number;
  longitude: number;
  /** Sign colour: availability (green/red), selection blue, etc. */
  color: string;
  /** Square-badge glyph mode (searched places); omit to render the sign. */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Selected station: bigger badge, blue halo ring, stronger aura. */
  selected?: boolean;
  /** Breathe on the Marker's native opacity; all pins breathe in unison. */
  blinking?: boolean;
  title: string;
  description?: string;
  onPress?: () => void;
};

function StationMarkerBase({
  latitude,
  longitude,
  color,
  icon,
  selected = false,
  blinking = false,
  title,
  description,
  onPress,
}: Props) {
  // Slow sine breathing on the Marker's NATIVE opacity - no view re-capture.
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!blinking) return;
    const id = setInterval(() => setT((Date.now() - T0) % CYCLE_MS), STEP_MS);
    return () => clearInterval(id);
  }, [blinking]);
  const wave = 0.5 + 0.5 * Math.sin(((t % CYCLE_MS) / CYCLE_MS) * Math.PI * 2);
  const lo = selected ? 0.75 : 0.45;

  // Freeze the badge into the marker icon shortly after mount (and again after
  // any visual change such as the selection colour) so per-frame view tracking
  // stays off. Breathing does not need tracking: it drives native opacity.
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t2 = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t2);
  }, [color, selected, icon]);

  const badgeW = selected ? 34 : 28;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      opacity={blinking ? lo + (1 - lo) * wave : 1}
      tracksViewChanges={tracks}
      zIndex={selected ? 6 : 2}
      title={title}
      description={description}
      onPress={onPress}>
      <View style={styles.wrap}>
        {selected ? (
          <View style={styles.glowLayer} pointerEvents="none">
            <View style={styles.selRing} />
          </View>
        ) : null}
        {icon ? (
          <>
            <Glow
              color={color}
              width={badgeW}
              height={badgeW}
              radius={badgeW / 3}
              strong={selected}
            />
            <View
              style={[
                styles.badge,
                {
                  width: badgeW,
                  height: badgeW,
                  borderRadius: badgeW / 3,
                  backgroundColor: color,
                  shadowColor: color,
                },
              ]}>
              <MaterialCommunityIcons name={icon} size={selected ? 19 : 16} color="#FFFFFF" />
            </View>
          </>
        ) : (
          <StationSignView color={color} width={badgeW} selected={selected} />
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 84,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  // A ring is a NORMAL (non-absolute) child so the layer's centering aligns it.
  glowRing: {},
  selRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.45)',
    backgroundColor: 'rgba(37, 99, 235, 0.20)',
  },
  glowBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sign: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 6,
    elevation: 5,
  },
  bars: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  bar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 6,
    elevation: 5,
  },
});

/** Memoised so each pin only re-renders when its own props change. */
export const StationMarker = memo(StationMarkerBase);