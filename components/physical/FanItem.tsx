import React, { ReactNode } from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

interface FanItemProps {
  /** Left edge of this item within the scroll content. */
  offset: number;
  width: number;
  scrollX: SharedValue<number>;
  /** Width of the visible strip; 0 until it has been measured. */
  viewport: SharedValue<number>;
  children: ReactNode;
  style?: object;
}

/**
 * One card in the horizontal fan, faded out as it reaches either end of the
 * strip.
 *
 * The card's own opacity is animated rather than laying a gradient over the
 * edges: the fan sits directly on the sky, so a gradient would need a colour to
 * fade into and there isn't one. Fading the card itself works over anything
 * behind it.
 */
export function FanItem({ offset, width, scrollX, viewport, children, style }: FanItemProps) {
  const animated = useAnimatedStyle(() => {
    // Where the card currently sits inside the visible strip.
    const x = offset - scrollX.value;
    const right = viewport.value;

    // Before measurement, don't hide anything.
    if (right <= 0) return { opacity: 1 };

    // The strip runs the full width of the screen, so a card stays completely
    // opaque for as long as it is on screen and only softens as it passes the
    // phone's own edge. Every card in the fan is therefore readable, rather
    // than dimming while there is still room to show it.
    const enteringLeft = interpolate(
      x,
      [-width * 0.85, -width * 0.25, 0],
      [0, 0.45, 1],
      Extrapolation.CLAMP
    );

    const leavingRight = interpolate(
      x + width,
      [right, right + width * 0.25, right + width * 0.85],
      [1, 0.45, 0],
      Extrapolation.CLAMP
    );

    return { opacity: Math.min(enteringLeft, leavingRight) };
  });

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
