import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

interface CaduceusProps {
  color: string;
  opacity?: number;
  /** Stroke weight in viewBox units; the drawing is 44 units wide. */
  weight?: number;
  /**
   * 'contain' fits the whole mark. 'bleed' fills the frame from the top down
   * and lets the staff run out of the bottom — the mark as something printed
   * across the stock rather than placed on it.
   */
  fit?: 'contain' | 'bleed';
  style?: StyleProp<ViewStyle>;
}

/**
 * The kerykeion: the wingless caduceus, after the engraved staff.
 *
 * Three parts stacked on one axis — the snakes rearing off the head, a tight
 * rope twist down the shaft, and a long plain staff below the collar. The
 * proportion is the whole thing: the head is a fifth of the height, the twist
 * about a third, and the bare staff the rest. Drawn with the snakes looping
 * wide it turns into a heart shape, so the loops stay narrow and near vertical,
 * with the heads curling back in over the nail-head finial.
 *
 * The viewBox is cropped to the drawing rather than to a square, so scaling by
 * width fills the frame with the mark instead of with the empty margin either
 * side of a staff that is mostly one line.
 *
 * Stroked, never filled: it sits on a card that is otherwise ruled lines and
 * small type, and a solid silhouette would be the only filled shape on it.
 */
export function Caduceus({
  color,
  opacity = 1,
  weight = 1.6,
  fit = 'contain',
  style,
}: CaduceusProps) {
  return (
    <Svg
      style={style}
      viewBox="28 6 44 258"
      preserveAspectRatio={fit === 'bleed' ? 'xMidYMin slice' : 'xMidYMid meet'}
    >
      <G
        stroke={color}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      >
        {/* nail-head finial, staff, and the knob at its foot */}
        <Path d="M43 30 H57" />
        <Path d="M50 30 V250" />
        <Ellipse cx={50} cy={252} rx={3.6} ry={4.6} />

        {/* the snakes rear off the head and curl back in above the finial */}
        <Path d="M50 50 C 60 47 66 39 66 29 C 66 19 60 13 55 16 C 51 18 51 22 54 25" />
        <Path d="M50 50 C 40 47 34 39 34 29 C 34 19 40 13 45 16 C 49 18 49 22 46 25" />
        <Ellipse cx={55.4} cy={24} rx={2.4} ry={1.7} />
        <Ellipse cx={44.6} cy={24} rx={2.4} ry={1.7} />

        {/* one path a snake, seven turns of a tight rope twist */}
        <Path d="M50 50 C 57 53 57 57 50 60 C 43 63 43 67 50 70 C 57 73 57 77 50 80 C 43 83 43 87 50 90 C 57 93 57 97 50 100 C 43 103 43 107 50 110 C 57 113 57 117 50 120" />
        <Path d="M50 50 C 43 53 43 57 50 60 C 57 63 57 67 50 70 C 43 73 43 77 50 80 C 57 83 57 87 50 90 C 43 93 43 97 50 100 C 57 103 57 107 50 110 C 43 113 43 117 50 120" />

        {/* the collar where the twist ends and the bare staff begins */}
        <Path d="M41 122 C 45 128 55 128 59 122" />
        <Path d="M43 121 H57" />
      </G>
    </Svg>
  );
}
