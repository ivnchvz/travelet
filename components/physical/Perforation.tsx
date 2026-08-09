import React from 'react';
import { StyleSheet, View } from 'react-native';

interface PerforationProps {
  /** Diameter of the punch-outs bitten into each edge. */
  notch: number;
  /** Colour showing through the cut — the surface behind the card. */
  cut: string;
  /** Roughly how wide each perforation slit is. */
  slit?: number;
  gap?: number;
}

/**
 * The tear line across a ticket: a bite taken out of each edge, and a run of
 * short slits between them.
 *
 * The slits are individual segments rather than a dashed border because a
 * border renders one continuous stroke with even gaps, which reads as a drawn
 * line. Real perforation is a row of little cuts, and at this size the
 * difference is the whole effect.
 */
export function Perforation({ notch, cut, slit = 7, gap = 6 }: PerforationProps) {
  // Rendered as a fixed count rather than measured: a few extra slits are
  // clipped by the parent, which is cheaper than an onLayout pass.
  const slits = Array.from({ length: 40 });

  return (
    <View style={[styles.row, { height: notch }]} pointerEvents="none">
      <View
        style={[
          styles.notch,
          { width: notch, height: notch, borderRadius: notch / 2, backgroundColor: cut, left: -notch / 2 },
        ]}
      />

      <View style={[styles.slits, { marginHorizontal: notch / 2 + 4, gap }]}>
        {slits.map((_, index) => (
          <View key={index} style={[styles.slit, { width: slit }]} />
        ))}
      </View>

      <View
        style={[
          styles.notch,
          { width: notch, height: notch, borderRadius: notch / 2, backgroundColor: cut, right: -notch / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
  },
  notch: {
    position: 'absolute',
    top: 0,
  },
  slits: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  slit: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
});
