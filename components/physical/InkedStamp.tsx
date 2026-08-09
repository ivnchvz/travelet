import { Canvas, Path } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet } from 'react-native';
import { withAlpha } from './theme';

export type StampShape =
  | 'rect'
  | 'round'
  | 'oval'
  | 'arch'
  | 'hex'
  | 'octagon'
  | 'capsule'
  | 'shield';

interface InkedStampProps {
  size: number;
  ink: string;
  shape: StampShape;
  /** Overall ink strength. */
  bite?: number;
}

/**
 * The frame of a stamp, as a real outline.
 *
 * The shape is built here and nowhere else. It used to be described twice —
 * once as CSS corner radii on the clipping view and once as a rounded rect in
 * the canvas — and the two never agreed, so on anything that wasn't a plain
 * rectangle the clip sliced pieces off the frame. A hexagon or an arch simply
 * cannot be expressed as border radii, which is why they need a path.
 *
 * Every stroke is additive: nothing subtracts, so no part of an outline can go
 * missing however the layers above it are tuned.
 */
export function InkedStamp({ size, ink, shape, bite = 1 }: InkedStampProps) {
  const outer = outlineFor(shape, size, 2.5);
  const inner = outlineFor(shape, size, 10);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Wide faint stroke first, so the edge bleeds into the paper */}
      <Path path={outer} color={withAlpha(ink, 0.2 * bite)} style="stroke" strokeWidth={5} />
      <Path path={outer} color={withAlpha(ink, 0.82 * bite)} style="stroke" strokeWidth={2.4} />

      <Path path={inner} color={withAlpha(ink, 0.12 * bite)} style="stroke" strokeWidth={3} />
      <Path path={inner} color={withAlpha(ink, 0.45 * bite)} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

/** An SVG path for each outline, inset from the edge of the stamp. */
export function outlineFor(shape: StampShape, size: number, inset: number): string {
  const a = inset;
  const b = size - inset;
  const w = b - a;
  const cx = size / 2;
  const cy = size / 2;
  const r = w / 2;

  const polygon = (sides: number, rotation: number) => {
    const points = Array.from({ length: sides }, (_, i) => {
      const angle = rotation + (i * 2 * Math.PI) / sides;
      return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
    });
    return `M${points.join(' L')} Z`;
  };

  switch (shape) {
    case 'oval':
      return `M${a},${cy} A${r},${r} 0 1 1 ${b},${cy} A${r},${r} 0 1 1 ${a},${cy} Z`;

    case 'capsule': {
      const rr = w * 0.3;
      return roundedRectPath(a, a + w * 0.16, w, w * 0.68, rr);
    }

    case 'hex':
      return polygon(6, -Math.PI / 2);

    case 'octagon':
      return polygon(8, Math.PI / 8);

    case 'arch':
      // Semicircular head over straight shoulders and a flat foot.
      return `M${a},${cy} A${r},${r} 0 0 1 ${b},${cy} L${b},${b} L${a},${b} Z`;

    case 'shield': {
      // Straight shoulders down to a rounded foot rather than a point. A point
      // leaves the bottom third of the box outside the outline, which is where
      // the date and the mark sit.
      const shoulder = a + w * 0.7;
      return [
        `M${a},${a}`,
        `L${b},${a}`,
        `L${b},${shoulder.toFixed(2)}`,
        `Q${b},${b} ${cx},${b}`,
        `Q${a},${b} ${a},${shoulder.toFixed(2)}`,
        'Z',
      ].join(' ');
    }

    case 'round':
      return roundedRectPath(a, a, w, w, w * 0.22);

    default:
      return roundedRectPath(a, a, w, w, 5);
  }
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M${x + radius},${y}`,
    `L${x + w - radius},${y}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `L${x + w},${y + h - radius}`,
    `Q${x + w},${y + h} ${x + w - radius},${y + h}`,
    `L${x + radius},${y + h}`,
    `Q${x},${y + h} ${x},${y + h - radius}`,
    `L${x},${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    'Z',
  ].join(' ');
}
