import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

export type TextureVariant =
  | 'leather'
  | 'paper'
  | 'linen'
  | 'cardboard'
  | 'noise'
  | 'planes'
  | 'halftone';

interface TextureProps {
  variant: TextureVariant;
  opacity?: number;
  /**
   * Multiplies the halftone's cell pitch. A pattern this fine beats against the
   * pixel grid once a surface is tilted or shrunk, and the interference reads
   * as travelling lines rather than as grain — so small surfaces want a coarser
   * cell than a full-size cover does. Ignored by the other variants.
   */
  scale?: number;
}

/**
 * Bayer 4×4 — the classic ordered-dither threshold matrix. A cell is inked when
 * its value falls under the threshold, which is what gives ordered dithering its
 * characteristic woven look rather than the clumping you get from random noise.
 */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Pixel pitch of one Bayer cell. Small enough to read as tone, not as polka dots. */
const DITHER_UNIT = 3;

/** Cells lit in the flat halftone. Six of sixteen reads as a light, even tone. */
const HALFTONE_THRESHOLD = 6;

/** Aircraft seen from above, drawn once and reused across the tile. */
const PLANE =
  'M12 1 L13.4 8 L22 12.8 L22 14.6 L13.4 12.9 L13.2 18.4 L16 20.2 L16 21.6 L12 20.4 L8 21.6 L8 20.2 L10.8 18.4 L10.6 12.9 L2 14.6 L2 12.8 L10.6 8 Z';

let patternSeq = 0;

/**
 * Procedural material grain, tiled as an SVG pattern over the whole surface.
 * leather — pebbled dot grain · paper — horizontal fibers and specks ·
 * linen — fine crosshatch weave · cardboard — vertical kraft fibers ·
 * noise — fine irregular grain, which also breaks up the banding a smooth
 * gradient shows on large flat areas · planes — a sparse field of aircraft,
 * turned at different angles so the tiling doesn't read as a grid ·
 * halftone — ordered dithering, Bayer cells at one fixed density.
 *
 * Everything here is one tiled pattern and one rect. That constraint is the
 * whole design: this used to have a dither whose density stepped across the
 * surface, which needed a mask per band, and a mask costs an offscreen render
 * pass. The carousel mounts every category at once, so five covers became
 * twenty-five offscreen passes sitting behind the pass deck's full-screen
 * backdrop blur — which resamples all of them on every frame it fades in.
 *
 * Static overlays rather than live canvases, for the same reason: the covers
 * rotate in 3D as they open, and a per-frame surface inside that transform is
 * what made them flicker before.
 */
export function Texture({ variant, opacity = 1, scale = 1 }: TextureProps) {
  // unique pattern ids per instance: SVG defs are global per page on web
  const id = React.useMemo(() => `tx-${variant}-${patternSeq++}`, [variant]);

  return (
    <Svg style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Defs>
        {variant === 'leather' && (
          <Pattern id={id} patternUnits="userSpaceOnUse" width={9} height={9}>
            <Circle cx={2} cy={2.5} r={1.1} fill="rgba(0,0,0,0.10)" />
            <Circle cx={6.5} cy={6} r={0.9} fill="rgba(0,0,0,0.08)" />
            <Circle cx={2.5} cy={3} r={0.8} fill="rgba(255,255,255,0.06)" />
            <Circle cx={7} cy={6.5} r={0.6} fill="rgba(255,255,255,0.05)" />
            <Circle cx={5} cy={1} r={0.5} fill="rgba(0,0,0,0.06)" />
          </Pattern>
        )}
        {variant === 'paper' && (
          <Pattern id={id} patternUnits="userSpaceOnUse" width={26} height={14}>
            <Line x1={1} y1={3} x2={11} y2={3.4} stroke="rgba(0,0,0,0.045)" strokeWidth={0.7} />
            <Line x1={14} y1={9} x2={25} y2={8.7} stroke="rgba(0,0,0,0.04)" strokeWidth={0.6} />
            <Line x1={5} y1={12} x2={12} y2={12.3} stroke="rgba(0,0,0,0.035)" strokeWidth={0.5} />
            <Circle cx={20} cy={4} r={0.5} fill="rgba(0,0,0,0.05)" />
            <Circle cx={8} cy={7} r={0.4} fill="rgba(0,0,0,0.04)" />
          </Pattern>
        )}
        {variant === 'halftone' && (
          <Pattern
            id={id}
            patternUnits="userSpaceOnUse"
            width={4 * DITHER_UNIT * scale}
            height={4 * DITHER_UNIT * scale}
          >
            {BAYER.flatMap((row, y) =>
              row.map((value, x) =>
                value < HALFTONE_THRESHOLD ? (
                  <Rect
                    key={`${x}-${y}`}
                    x={x * DITHER_UNIT * scale}
                    y={y * DITHER_UNIT * scale}
                    width={1.4 * scale}
                    height={1.4 * scale}
                    fill="rgba(0,0,0,0.5)"
                  />
                ) : null
              )
            )}
          </Pattern>
        )}
        {variant === 'planes' && (
          <Pattern id={id} patternUnits="userSpaceOnUse" width={58} height={58}>
            {/* One silhouette, placed three times at different sizes and
                angles. A single upright plane per tile would read as a grid of
                planes rather than as a texture. */}
            <Path d={PLANE} fill="rgba(255,255,255,0.5)" transform="translate(6,4) rotate(18) scale(0.5)" />
            <Path d={PLANE} fill="rgba(255,255,255,0.34)" transform="translate(38,26) rotate(-34) scale(0.36)" />
            <Path d={PLANE} fill="rgba(255,255,255,0.42)" transform="translate(20,42) rotate(62) scale(0.42)" />
          </Pattern>
        )}
        {variant === 'noise' && (
          <Pattern id={id} patternUnits="userSpaceOnUse" width={37} height={37}>
            <Circle cx={3} cy={5} r={0.7} fill="rgba(255,255,255,0.16)" />
            <Circle cx={11} cy={2} r={0.5} fill="rgba(0,0,0,0.12)" />
            <Circle cx={19} cy={8} r={0.65} fill="rgba(255,255,255,0.13)" />
            <Circle cx={27} cy={3} r={0.5} fill="rgba(0,0,0,0.10)" />
            <Circle cx={33} cy={11} r={0.6} fill="rgba(255,255,255,0.14)" />
            <Circle cx={6} cy={14} r={0.55} fill="rgba(0,0,0,0.11)" />
            <Circle cx={15} cy={18} r={0.7} fill="rgba(255,255,255,0.15)" />
            <Circle cx={24} cy={16} r={0.5} fill="rgba(0,0,0,0.10)" />
            <Circle cx={31} cy={21} r={0.6} fill="rgba(255,255,255,0.12)" />
            <Circle cx={2} cy={24} r={0.6} fill="rgba(0,0,0,0.12)" />
            <Circle cx={9} cy={29} r={0.55} fill="rgba(255,255,255,0.14)" />
            <Circle cx={18} cy={26} r={0.5} fill="rgba(0,0,0,0.09)" />
            <Circle cx={26} cy={31} r={0.7} fill="rgba(255,255,255,0.13)" />
            <Circle cx={34} cy={28} r={0.5} fill="rgba(0,0,0,0.11)" />
            <Circle cx={13} cy={34} r={0.6} fill="rgba(255,255,255,0.12)" />
            <Circle cx={22} cy={35} r={0.5} fill="rgba(0,0,0,0.10)" />
          </Pattern>
        )}
        {variant === 'linen' && (
          <Pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6}>
            <Line x1={0} y1={1.5} x2={6} y2={1.5} stroke="rgba(0,0,0,0.035)" strokeWidth={0.6} />
            <Line x1={0} y1={4.5} x2={6} y2={4.5} stroke="rgba(0,0,0,0.03)" strokeWidth={0.5} />
            <Line x1={1.5} y1={0} x2={1.5} y2={6} stroke="rgba(0,0,0,0.03)" strokeWidth={0.5} />
            <Line x1={4.5} y1={0} x2={4.5} y2={6} stroke="rgba(0,0,0,0.025)" strokeWidth={0.5} />
          </Pattern>
        )}
        {variant === 'cardboard' && (
          <Pattern id={id} patternUnits="userSpaceOnUse" width={18} height={22}>
            <Line x1={3} y1={1} x2={2.6} y2={9} stroke="rgba(90,60,20,0.07)" strokeWidth={0.8} />
            <Line x1={9} y1={8} x2={9.3} y2={19} stroke="rgba(90,60,20,0.06)" strokeWidth={0.7} />
            <Line x1={15} y1={2} x2={14.8} y2={12} stroke="rgba(90,60,20,0.05)" strokeWidth={0.6} />
            <Line x1={6} y1={14} x2={5.8} y2={21} stroke="rgba(255,255,255,0.10)" strokeWidth={0.6} />
            <Circle cx={12} cy={5} r={0.6} fill="rgba(90,60,20,0.06)" />
          </Pattern>
        )}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
