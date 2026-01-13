import React from 'react';
import { LayoutChangeEvent, useWindowDimensions, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

interface AnimatedItemProps {
  children: React.ReactNode;
  scrollY: SharedValue<number>;
  style?: ViewStyle;
  itemHeight?: number; // Make it optional to avoid breaking other usages if any
  containerHeight?: number; // Measured height of the scroll container
}

export const AnimatedItem: React.FC<AnimatedItemProps> = ({
  children,
  scrollY,
  style,
  itemHeight: fixedHeight,
  containerHeight,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  // Use provided container height or fallback to window height
  const effectiveContainerHeight = containerHeight || windowHeight;

  const measuredY = useSharedValue(0);
  const measuredHeight = useSharedValue(0);

  const onLayout = (event: LayoutChangeEvent) => {
    measuredY.value = event.nativeEvent.layout.y;
    measuredHeight.value = event.nativeEvent.layout.height;
  };

  const animatedStyle = useAnimatedStyle(() => {
    // Use fixed height if provided, otherwise measured height
    const height = fixedHeight || measuredHeight.value;
    const y = measuredY.value;

    // If layout hasn't been measured yet (and no fixed height), show normally
    if (y === 0 && height === 0) return {};

    // Calculate centers
    const viewportCenter = scrollY.value + effectiveContainerHeight / 2;
    const itemCenter = y + height / 2;

    // Distance from center
    const distanceFromCenter = Math.abs(viewportCenter - itemCenter);

    // Snapping Focus Logic
    // Since we snap to one item, the focus range is effectively the item height
    // Items that are adjacent (1 height away) should be visibly smaller
    const SNAP_RANGE = height;

    // Focus Plateau: Items within +/- 50px of center stay fully focused
    // This provides tolerance for slight misalignments
    const FOCUS_PLATEAU = 50;

    // Opacity: Center Plateau 1.0 -> Adjacent 0.5 -> Far 0.3
    const opacity = interpolate(
      distanceFromCenter,
      [0, FOCUS_PLATEAU, SNAP_RANGE, effectiveContainerHeight],
      [1, 1, 0.5, 0.3],
      Extrapolation.CLAMP
    );

    // Scale: Center Plateau 1.0 -> Adjacent 0.95 -> Far 0.8
    const scale = interpolate(
      distanceFromCenter,
      [0, FOCUS_PLATEAU, SNAP_RANGE, effectiveContainerHeight],
      [1.0, 1.0, 0.95, 0.8],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View onLayout={onLayout} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};
