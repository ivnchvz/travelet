import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
/** The red the rest of the app deletes in. */
const TOSS_RED = '255,59,48';

/**
 * How far past each line the warning washes out.
 *
 * Longer upward, where there is room for it and where the wash has a second
 * job: the strip cuts a dragged card off at its own edge, and above the fan
 * that edge falls inside this band, so the card goes into the wash rather than
 * into a hard line. Downward the strip's edge and the line are the same place,
 * so the band only has to say which side of it is dangerous.
 */
const BAND = { top: 118, bottom: 56 };

interface TossBoundaryProps {
  /**
   * How far the card in the hand has come toward being thrown away, as a
   * signed fraction of the distance in that direction: negative up, positive
   * down, 1 either way meaning let go and it is gone.
   */
  progress: SharedValue<number>;
  /** Where the line sits above the cards' resting centre. */
  up: number;
  /** And below it — further, to clear the print that closes the object. */
  down: number;
  /**
   * How far the boundary reaches past the interior on each side.
   *
   * The interior is inset from the phone, but the edge of the throw-out area
   * is a fact about the screen, not about the object sitting on it: a band
   * that stopped at the object's own margins would read as part of the object.
   */
  bleed?: number;
}

/**
 * The line a card has to cross before letting go throws it away.
 *
 * Pulling a card out of the fan and releasing it deletes it, and until now the
 * only way to find out where that happened was to do it. The distance was
 * never a secret — it just wasn't drawn. This draws it: nothing at rest, an
 * edge fading up as the card is carried toward it, and the edge going solid
 * with the reason written on it once the card is far enough that letting go
 * would be the end of it.
 *
 * It lives on the fan rather than on the card because every card rests on the
 * same centre line, so one boundary is right for whichever card is moving —
 * and a card cannot draw the edge it is being carried away from.
 */
export function TossBoundary({ progress, up, down, bleed = 0 }: TossBoundaryProps) {
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { left: -bleed, right: -bleed }]}
      pointerEvents="none"
    >
      <Edge progress={progress} side="top" distance={up} band={BAND.top} />
      <Edge progress={progress} side="bottom" distance={down} band={BAND.bottom} />
    </Animated.View>
  );
}

function Edge({
  progress,
  side,
  distance,
  band: length,
}: {
  progress: SharedValue<number>;
  side: 'top' | 'bottom';
  distance: number;
  band: number;
}) {
  const up = side === 'top';
  // Positive once the card is heading for *this* edge, so the other one stays
  // out of it — two lines lighting up for one drag would read as a corridor
  // rather than as the edge being approached.
  const sign = up ? -1 : 1;

  const band = useAnimatedStyle(() => {
    const p = progress.value * sign;
    return {
      opacity: interpolate(p, [0.2, 0.85], [0, 1], Extrapolation.CLAMP),
    };
  });

  const line = useAnimatedStyle(() => {
    const p = progress.value * sign;
    const armed = interpolate(p, [0.86, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 0.42 + armed * 0.58,
      // The line puts on weight as it arms. Growing a hairline from its own
      // edge would slide it off the distance it is there to mark, so it grows
      // from its middle and stays on the line.
      transform: [{ scaleY: 1 + armed * 2.2 }],
    };
  });

  const label = useAnimatedStyle(() => {
    const p = progress.value * sign;
    const armed = interpolate(p, [0.88, 1.02], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: armed,
      transform: [{ translateY: (1 - armed) * (up ? 5 : -5) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.edge,
        {
          height: length,
          // The band lies outside the line: above it going up, below going down.
          marginTop: up ? -length : 0,
          transform: [{ translateY: sign * distance }],
        },
        band,
      ]}
      pointerEvents="none"
    >
      {/* The wash beyond the line, heaviest against it and gone by the far
          side of the band, so the area has no edge of its own but the line.
          It runs to the sides of the phone, which are edges already. */}
      <LinearGradient
        colors={
          up
            ? ['rgba(255,59,48,0)', `rgba(${TOSS_RED},0.15)`]
            : [`rgba(${TOSS_RED},0.15)`, 'rgba(255,59,48,0)']
        }
        style={StyleSheet.absoluteFill}
      />
      {/* The line runs out rather than stopping: a rule with two hard ends
          reads as a drawn object sitting on the fan, where this is meant to
          read as the fan itself going dangerous toward one edge. */}
      <Animated.View style={[styles.line, up ? styles.lineBottom : styles.lineTop, line]}>
        <LinearGradient
          colors={[
            'rgba(255,59,48,0)',
            `rgba(${TOSS_RED},0.9)`,
            `rgba(${TOSS_RED},0.9)`,
            'rgba(255,59,48,0)',
          ]}
          locations={[0, 0.16, 0.84, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.Text style={[styles.label, up ? styles.labelUp : styles.labelDown, label]}>
        Throw out
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /**
   * Hung off the middle of the fan, which is where every card rests, and moved
   * out by exactly the distance the gesture arms at.
   */
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  lineBottom: {
    bottom: 0,
  },
  lineTop: {
    top: 0,
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: `rgba(${TOSS_RED},0.92)`,
  },
  labelUp: {
    bottom: 7,
  },
  labelDown: {
    top: 7,
  },
});
