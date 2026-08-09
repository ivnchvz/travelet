import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { InkedStamp } from './InkedStamp';
import { Country } from '../../services/Countries';
import { Visit } from '../../services/VisitService';
import { withAlpha } from './theme';
import { Texture } from './Texture';

interface StampProps {
  country: Country;
  visit: Visit;
  size?: number;
  /** Degrees of tilt, so a page of stamps looks pressed by hand. */
  angle?: number;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function stampDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * A souvenir stamp for a visited country, drawn rather than drawn *from* — one
 * renderer covers every country from its data, so the set scales past the
 * fifty without fifty pieces of artwork.
 *
 * Deliberately not a facsimile of any real immigration stamp. It carries the
 * app's own name, its own shapes and its own palette, so it reads as a keepsake
 * and could not be mistaken for an official mark.
 */
export function Stamp({ country, visit, size = 132, angle = -6 }: StampProps) {
  const ink = country.ink;
  // The texture sits on a shape close to the frame's own, so grain and blooms
  // can't show as a square patch outside a hexagon or an arch.
  const groundRadius = groundRadiusFor(country.shape, size);
  // Shapes that narrow at one end need their content pulled in from that end,
  // or the smallest lines sit outside the outline.
  const pad = contentPadFor(country.shape, size);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          transform: [{ rotate: `${angle}deg` }],
          // Ink is never fully opaque, and it's what lets overlapping stamps
          // read through one another the way they do on a real page.
          opacity: 0.84,
        },
      ]}
    >
      <View style={[styles.body, pad]}>
        {/* Additive strokes only — the wear comes from the layers over them */}
        <InkedStamp size={size} ink={ink} shape={country.shape} />

        <View style={[styles.ground, { borderRadius: groundRadius }]} pointerEvents="none">
        {/* Uneven coverage: grain plus a few pale blooms where the pad didn't
            take, so the impression looks pressed rather than printed. */}
        <Texture variant="noise" opacity={1} />

        {/* Pressed at an angle, so one corner takes more ink than the other */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.34)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.15, y: 0.05 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.bloom, { top: '12%', left: '8%', width: size * 0.4, height: size * 0.28 }]} />
        <View style={[styles.bloom, { bottom: '16%', right: '10%', width: size * 0.34, height: size * 0.22 }]} />
        <View style={[styles.bloom, { top: '46%', right: '32%', width: size * 0.22, height: size * 0.16 }]} />
        </View>

        <Text style={[styles.code, { color: ink, textShadowColor: withAlpha(ink, 0.5) }]} numberOfLines={1}>
          {country.code}
        </Text>

        <Ionicons name={country.motif} size={size * 0.2} color={withAlpha(ink, 0.9)} />

        <Text style={[styles.entry, { color: withAlpha(ink, 0.9), textShadowColor: withAlpha(ink, 0.4) }]} numberOfLines={1}>
          {country.entry.toUpperCase()}
        </Text>

        <View style={[styles.rule, { backgroundColor: withAlpha(ink, 0.5) }]} />

        <Text style={[styles.date, { color: ink, textShadowColor: withAlpha(ink, 0.45) }]} numberOfLines={1}>
          {stampDate(visit.date)}
        </Text>

        <Text style={[styles.brand, { color: withAlpha(ink, 0.55) }]} numberOfLines={1}>
          TRAVELET
        </Text>
      </View>
    </View>
  );
}

/** Extra breathing room where an outline closes in. */
function contentPadFor(shape: Country['shape'], size: number) {
  switch (shape) {
    case 'shield':
      return { paddingBottom: size * 0.16 };
    case 'arch':
      return { paddingTop: size * 0.12 };
    case 'oval':
    case 'capsule':
      return { paddingHorizontal: size * 0.16 };
    case 'hex':
    case 'octagon':
      return { paddingHorizontal: size * 0.13 };
    default:
      return null;
  }
}

/** Keeps the grain inside the outline without trying to reproduce it exactly. */
function groundRadiusFor(shape: Country['shape'], size: number): number {
  switch (shape) {
    case 'oval':
    case 'capsule':
      return size / 2;
    case 'hex':
    case 'octagon':
    case 'shield':
      return size * 0.24;
    case 'arch':
      return size * 0.2;
    case 'round':
      return size * 0.2;
    default:
      return 6;
  }
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ground: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    // Ink sits *on* the page rather than covering it, so the paper shows through
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bloom: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  code: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.6,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 19,
    letterSpacing: 1.5,
  },
  entry: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.6,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 8.5,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  rule: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: 5,
  },
  date: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.6,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  brand: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.6,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 6.5,
    letterSpacing: 2,
    marginTop: 3,
  },
});
