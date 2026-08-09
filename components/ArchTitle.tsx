import React, { useEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** The face the app's own wordmark is set in. */
const TITLE_FONT = 'BeVietnamPro-Black';

const NARROW = "iIlj!.,;:'`|";
const WIDE = 'MWmw@';

/**
 * Roughly how much room a glyph takes, as a fraction of the type size.
 *
 * Text laid on an arc has to be positioned a letter at a time, and React Native
 * has no synchronous way to measure one. Stepping by a fixed angle instead is
 * the usual shortcut and it shows: it opens gaps around an `I` and crowds a
 * `W`. Four buckets are enough to keep the spacing even by eye.
 */
function advance(ch: string, size: number): number {
  if (ch === ' ') return size * 0.3;
  if (NARROW.includes(ch)) return size * 0.34;
  if (WIDE.includes(ch)) return size * 0.92;
  const isCap = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  return size * (isCap ? 0.7 : 0.58);
}

interface ArchTitleProps {
  text: string;
  size?: number;
  /** Arc radius. Smaller bends the title harder. */
  radius?: number;
  tracking?: number;
  color?: string;
  /**
   * Whether the title is showing. It arrives when this turns true, so a card
   * still off-screen does not spend its entrance where nobody is looking — by
   * the time you scrolled to it, it had already played.
   */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface Placed {
  ch: string;
  x: number;
  y: number;
  deg: number;
  index: number;
}

/**
 * A title bent over an arch, arriving a letter at a time.
 *
 * Every letter is placed along a circle by arc length rather than by a fixed
 * angular step, so the spacing follows the widths of the letters the way it
 * would on a straight line, and each one is turned to sit square on the curve.
 *
 * The entrance runs off a single value with a per-letter offset, the same way
 * the papers rise out of an opening object — one curve, staggered, rather than
 * one animation per letter racing the others.
 */
export function ArchTitle({
  text,
  size = 22,
  radius = 210,
  tracking = 1.5,
  color = '#020403',
  active = true,
  style,
}: ArchTitleProps) {
  const { letters, height } = useMemo(() => {
    const chars = [...text];
    const widths = chars.map((ch) => advance(ch, size));
    const total =
      widths.reduce((sum, w) => sum + w, 0) + tracking * Math.max(chars.length - 1, 0);

    let travelled = 0;
    let lowest = 0;
    const placed: Placed[] = chars.map((ch, index) => {
      const centre = travelled + widths[index] / 2;
      travelled += widths[index] + tracking;
      // arc length from the apex, turned into an angle
      const theta = (centre - total / 2) / radius;
      const y = radius * (1 - Math.cos(theta));
      lowest = Math.max(lowest, y);
      return {
        ch,
        x: radius * Math.sin(theta),
        y,
        deg: (theta * 180) / Math.PI,
        index,
      };
    });

    return { letters: placed, height: lowest + size * 1.45 };
  }, [text, size, radius, tracking]);

  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(active ? 1 : 0, {
      duration: active ? 520 + letters.length * 26 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [appear, active, text, letters.length]);

  const box = size * 1.25;
  const step = letters.length > 1 ? 0.5 / (letters.length - 1) : 0;

  return (
    <View style={[styles.arch, { height }, style]} pointerEvents="none">
      {letters.map((letter) => (
        <Letter
          key={`${letter.ch}-${letter.index}`}
          letter={letter}
          appear={appear}
          step={step}
          box={box}
          size={size}
          color={color}
        />
      ))}
    </View>
  );
}

function Letter({
  letter,
  appear,
  step,
  box,
  size,
  color,
}: {
  letter: Placed;
  appear: ReturnType<typeof useSharedValue<number>>;
  step: number;
  box: number;
  size: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const from = letter.index * step;
    const p = interpolate(appear.value, [from, from + 0.5], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [
        { translateX: letter.x },
        { translateY: letter.y + (1 - p) * 12 },
        { rotate: `${letter.deg}deg` },
        { scale: 0.86 + p * 0.14 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.letter, { width: box, marginLeft: -box / 2 }, style]}>
      <Text style={[styles.glyph, { fontSize: size, lineHeight: size * 1.24, color }]}>
        {letter.ch}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  arch: {
    /**
     * Stretched, not `width: '100%'`.
     *
     * The caller pins this with left and right, and an explicit full width
     * fights that: the width resolves against the parent's whole box while the
     * insets resolve against its padding, so the arch came out wider than its
     * frame and its centre sat off to one side of the screen. Every letter is
     * placed from that centre, so the whole title leaned.
     */
    alignSelf: 'stretch',
  },
  letter: {
    position: 'absolute',
    left: '50%',
    top: 0,
    alignItems: 'center',
  },
  glyph: {
    fontFamily: TITLE_FONT,
    textAlign: 'center',
  },
});
