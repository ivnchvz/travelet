import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { withAlpha } from './theme';
import { Texture } from './Texture';

interface GlassLayersProps {
  /** Light-to-dark stops for the surface tint. */
  gradient: string[];
  /** Corner radius of the surface being filled, for the edge highlight. */
  radius: number;
  /** Lowest tint opacity, at the light end. Raise it if text stops reading. */
  baseAlpha?: number;
  /** How much the tint deepens towards the dark end. */
  alphaRange?: number;
  /** Strength of the soft light bloom in the upper-left. */
  glow?: number;
  noise?: number;
}

/**
 * The material every glass surface in the app is made of, in one place so the
 * miniature card and the full pass can't drift apart.
 *
 * Tuned to stay genuinely see-through: the tint sits well under half opacity so
 * the sky and clouds behind read through the card, which is the whole point of
 * the look. Text legibility is bought back with a shadow rather than by making
 * the panel more solid.
 *
 * Layers, bottom to top:
 *  1. the colour, as a many-stop translucent gradient — enough stops that it
 *     reads as a continuous wash rather than a few bands
 *  2. a radial bloom, so light appears to fall on the card from one direction
 *  3. fine grain, which besides looking like a real material is the standard
 *     cure for the banding a smooth gradient shows across a large flat area
 *  4. a hairline edge to catch the light
 *
 * Every layer fades to nothing at its boundary. Anything with a hard stop draws
 * a visible line across the card, which is exactly what this replaced.
 */
export function GlassLayers({
  gradient,
  radius,
  baseAlpha = 0.3,
  alphaRange = 0.22,
  glow = 0.45,
  noise = 0.8,
}: GlassLayersProps) {
  const stops = gradient.length > 1 ? gradient : [gradient[0] ?? '#000', gradient[0] ?? '#000'];

  const tint = stops.map((color, index) =>
    withAlpha(color, baseAlpha + (index / (stops.length - 1)) * alphaRange)
  ) as unknown as readonly [string, string, ...string[]];

  const highlight = stops[0];

  return (
    <>
      <LinearGradient
        colors={tint}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Bloom: an ellipse well past the top-left corner, so only its soft
          falloff is on the card and the bright core never shows an edge. */}
      {glow > 0 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="glassGlow" cx="22%" cy="8%" rx="85%" ry="70%">
              <Stop offset="0" stopColor={highlight} stopOpacity={0.85 * glow} />
              <Stop offset="0.45" stopColor={highlight} stopOpacity={0.3 * glow} />
              <Stop offset="1" stopColor={highlight} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="22%" cy="8%" rx="95%" ry="80%" fill="url(#glassGlow)" />
        </Svg>
      )}

      {/* A touch of light on the top edge only — kept low, since a heavier
          white film is what made the colour look washed out. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {noise > 0 && <Texture variant="noise" opacity={noise} />}

      <View
        style={[
          StyleSheet.absoluteFill,
          styles.edge,
          { borderRadius: radius },
        ]}
        pointerEvents="none"
      />
    </>
  );
}

const styles = StyleSheet.create({
  edge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
  },
});
