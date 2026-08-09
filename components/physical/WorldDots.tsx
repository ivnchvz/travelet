import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LandBox, MAP_COLS, MAP_ROWS, project, worldDotsPaths } from './worldMap';

interface WorldDotsProps {
  /** Dot colour for the world at large. */
  color: string;
  /** Dot radius in grid units, where one unit is one cell. Under ~0.2 the map
   *  reads as noise; over ~0.5 the dots touch and it reads as a silhouette. */
  radius?: number;
  opacity?: number;
  /** The country to light up, and the colour to light it with. */
  lit?: LandBox;
  litColor?: string;
  /** Lit dots are drawn a little larger so a one-cell country still reads. */
  litRadius?: number;
  /**
   * How much of the world's width to show, 0-1. Below 1 the map is a window
   * onto the world rather than the whole of it: the dots grow, and what falls
   * outside the window is simply not drawn.
   */
  zoom?: number;
  /** Longitude the window is centred on, clamped so it never runs off the map. */
  centerLon?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The world drawn as a halftone grid, with one country lit.
 *
 * Two paths rather than two thousand circles; see `worldMap.ts` for why.
 *
 * The window pans as well as zooms. A window fixed on the prime meridian cuts
 * the Pacific rim off both ends — Japan, Korea, the Philippines, Australia and
 * New Zealand all sit within a few degrees of the edge — so a zoomed map that
 * did not follow the country would fail precisely the passports it is drawn
 * for. Panning to the country and clamping at the map's ends keeps it on the
 * cover without ever showing empty space past the dateline.
 */
export function WorldDots({
  color,
  radius = 0.36,
  opacity = 1,
  lit,
  litColor = '#ffffff',
  litRadius = 0.5,
  zoom = 1,
  centerLon = 0,
  style,
}: WorldDotsProps) {
  const paths = useMemo(
    () => worldDotsPaths(radius, litRadius, lit),
    [radius, litRadius, lit]
  );

  const windowWidth = MAP_COLS * Math.min(Math.max(zoom, 0.1), 1);
  const wanted = project(centerLon, 0).x - windowWidth / 2;
  const left = Math.min(Math.max(wanted, 0), MAP_COLS - windowWidth);

  return (
    <Svg
      style={style}
      viewBox={`${left} 0 ${windowWidth} ${MAP_ROWS}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Path d={paths.rest} fill={color} opacity={opacity} />
      {paths.lit.length > 0 && <Path d={paths.lit} fill={litColor} />}
    </Svg>
  );
}
