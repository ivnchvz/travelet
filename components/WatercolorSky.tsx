import {
  Blur,
  Canvas,
  DisplacementMap,
  Fill,
  Group,
  Path,
  Skia,
  SkPath,
  Turbulence,
} from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { SkyPalette, SkyPhase } from '../services/SkyService';

/** Deterministic noise in 0..1 — the same sky every time the app opens. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function at(colors: readonly string[], index: number): string {
  return colors[Math.min(index, colors.length - 1)];
}

/** Blend a hex colour toward white. */
function mix(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (255 - v) * amount);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/**
 * A closed, irregular blob.
 *
 * The corners are jittered off a circle and joined through their midpoints, so
 * the outline stays smooth while never repeating a radius. A true circle is the
 * one shape a wash never makes, and it is the shape a blurred view can only
 * ever be — which is most of why the old sky read as fog rather than paint.
 */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number): SkPath {
  const points = 12;
  const path = Skia.Path.Make();
  const ring: [number, number][] = [];

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const reach = 0.74 + rnd(seed + i * 3.7) * 0.42;
    ring.push([cx + Math.cos(angle) * rx * reach, cy + Math.sin(angle) * ry * reach]);
  }

  const midpoint = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];

  const start = midpoint(ring[points - 1], ring[0]);
  path.moveTo(start[0], start[1]);
  for (let i = 0; i < points; i++) {
    const corner = ring[i];
    const next = midpoint(corner, ring[(i + 1) % points]);
    path.quadTo(corner[0], corner[1], next[0], next[1]);
  }
  path.close();
  return path;
}

/** Where the washes are laid, as fractions of the screen. */
const WASHES = [
  { cx: 0.12, cy: 0.09, rx: 0.58, ry: 0.20, tone: 0, alpha: 0.42, bleed: 14, warp: 34, seed: 3 },
  { cx: 0.80, cy: 0.23, rx: 0.44, ry: 0.16, tone: 1, alpha: 0.34, bleed: 11, warp: 28, seed: 11 },
  { cx: 0.20, cy: 0.45, rx: 0.40, ry: 0.15, tone: 2, alpha: 0.30, bleed: 16, warp: 40, seed: 19 },
  { cx: 0.72, cy: 0.61, rx: 0.50, ry: 0.19, tone: 1, alpha: 0.36, bleed: 12, warp: 30, seed: 27 },
  { cx: 0.16, cy: 0.83, rx: 0.46, ry: 0.18, tone: 3, alpha: 0.32, bleed: 15, warp: 36, seed: 35 },
];

/** Extra weight when the weather turns. */
const OVERCAST = [
  { cx: 0.46, cy: 0.15, rx: 0.52, ry: 0.17, tone: 2, alpha: 0.26, bleed: 18, warp: 44, seed: 43 },
  { cx: 0.86, cy: 0.50, rx: 0.44, ry: 0.16, tone: 2, alpha: 0.24, bleed: 17, warp: 38, seed: 51 },
];

interface WashProps {
  path: SkPath;
  color: string;
  alpha: number;
  bleed: number;
  warp: number;
  seed: number;
}

/**
 * One laid wash.
 *
 * Drawn twice: a body at low opacity and the same outline stroked over it. That
 * stroke is the whole point — as a wash dries the pigment is carried to its
 * boundary and settles there, so a wash is *darkest at its rim*. A blurred
 * shape is densest in the middle, which is the exact opposite, and no amount of
 * softening fixes it.
 *
 * Both go down in multiply, so where two washes cross they deepen the way
 * layered glazes do instead of averaging like stacked translucent views.
 */
function Wash({ path, color, alpha, bleed, warp, seed }: WashProps) {
  return (
    <Group>
      {/* the wandering edge: pixels pushed around by a turbulence field */}
      <DisplacementMap channelX="r" channelY="g" scale={warp}>
        <Turbulence freqX={0.012} freqY={0.016} octaves={2} seed={seed} />
      </DisplacementMap>
      <Blur blur={bleed} />
      <Path path={path} color={color} opacity={alpha} blendMode="multiply" />
      <Path
        path={path}
        color={color}
        opacity={alpha * 0.9}
        style="stroke"
        strokeWidth={bleed * 1.6}
        blendMode="multiply"
      />
    </Group>
  );
}

interface WatercolorSkyProps {
  sky: SkyPalette;
  phase: SkyPhase;
  overcast: boolean;
}

/**
 * The sky, painted rather than lit.
 *
 * The ground is paper — the palette's own bottom colour taken most of the way
 * to white — and every colour above it is a transparent wash over that paper.
 * This is the difference between watercolour and a gradient: the light comes
 * from underneath the paint, not from the paint.
 *
 * Nothing moves. The filters here are costly to compute and free to leave
 * alone, so a Canvas with static props paints once and then sits there. The
 * clouds used to drift; the app has motion enough elsewhere, and a wash that
 * slides is a wash that has to be re-filtered every frame.
 */
export function WatercolorSky({ sky, phase, overcast }: WatercolorSkyProps) {
  const { width, height } = useWindowDimensions();

  // Night is stained paper, not a lit screen: barely whitened, so the washes
  // read as pigment soaked into a dark ground.
  const paper = mix(at(sky.colors, sky.colors.length - 1), phase === 'night' ? 0.1 : 0.52);
  const tones = [at(sky.colors, 0), at(sky.colors, 1), at(sky.colors, 2), at(sky.colors, 4)];

  const laid = useMemo(() => {
    const specs = overcast ? [...WASHES, ...OVERCAST] : WASHES;
    return specs.map((w) => ({
      ...w,
      path: blob(w.cx * width, w.cy * height, w.rx * width, w.ry * height, w.seed),
    }));
  }, [width, height, overcast]);

  const glow = useMemo(
    () =>
      blob(
        width * (sky.glowPosition === 'horizon' ? 0.3 : 0.78),
        height * (sky.glowPosition === 'horizon' ? 0.95 : 0.12),
        width * 0.6,
        height * 0.24,
        71
      ),
    [width, height, sky.glowPosition]
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill color={paper} />

      {phase !== 'night' && (
        <Wash path={glow} color={sky.glow} alpha={0.3} bleed={22} warp={30} seed={71} />
      )}

      {laid.map((w) => (
        <Wash
          key={w.seed}
          path={w.path}
          color={tones[w.tone]}
          alpha={w.alpha}
          bleed={w.bleed}
          warp={w.warp}
          seed={w.seed}
        />
      ))}

      {/* Granulation: pigment settling into the tooth of the paper. High
          frequency, low opacity — felt rather than seen. */}
      <Fill opacity={0.1} blendMode="multiply">
        <Turbulence freqX={0.85} freqY={0.85} octaves={3} seed={5} />
      </Fill>
    </Canvas>
  );
}
