import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  getSkyPalette,
  getSkyPhase,
  SKY,
  SkyPhase,
  SkyWeather,
} from '../services/SkyService';
import { WatercolorSky } from './WatercolorSky';

/** Crescent moon and a field of stars for the night sky. */
function NightSky({ skyTop }: { skyTop: string }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        cx: ((i * 73) % 100) + (i % 3),
        cy: ((i * 37) % 72) + 2,
        r: 0.6 + ((i * 17) % 10) / 11,
        o: 0.25 + ((i * 29) % 10) / 16,
      })),
    []
  );
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((st, i) => (
        <Circle
          key={i}
          cx={`${st.cx}%`}
          cy={`${st.cy}%`}
          r={st.r}
          fill="#e8eeff"
          opacity={st.o}
        />
      ))}
      {/* crescent: a bright disc partly eclipsed by a sky-colored disc */}
      <Circle cx="80%" cy="26%" r={17} fill="#e9edfb" />
      <Circle cx="82.5%" cy="24.8%" r={15} fill={skyTop} />
    </Svg>
  );
}

function RainDrop({ index, screenW, screenH }: { index: number; screenW: number; screenH: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      (index * 137) % 900,
      withRepeat(
        withTiming(1, { duration: 850 + ((index * 53) % 500), easing: Easing.linear }),
        -1,
        false
      )
    );
  }, [v, index]);
  const x = (index * 79) % screenW;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x }, { translateY: -40 + v.value * (screenH + 80) }],
  }));
  return <Animated.View style={[styles.rainDrop, style]} />;
}

function SnowFlake({ index, screenW, screenH }: { index: number; screenW: number; screenH: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      (index * 311) % 3000,
      withRepeat(
        withTiming(1, { duration: 6000 + ((index * 97) % 3000), easing: Easing.linear }),
        -1,
        false
      )
    );
  }, [v, index]);
  const x = (index * 61) % screenW;
  const size = 3 + (index % 3);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + Math.sin(v.value * Math.PI * 2 + index) * 14 },
      { translateY: -20 + v.value * (screenH + 40) },
    ],
  }));
  return (
    <Animated.View
      style={[styles.snowFlake, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

interface CloudBackgroundProps {
  phase?: SkyPhase;
  weather?: SkyWeather;
}

/**
 * The sky behind everything. It knows what time it is (dawn, midday, dusk,
 * night…) and can be told what the weather is like, then dresses accordingly.
 *
 * The sky itself is painted: transparent washes laid over paper, rather than a
 * gradient with blurred shapes floating on it. What is left here is everything
 * that should stay crisp in front of the paint — the moon and stars, and the
 * weather actually falling.
 */
export function CloudBackground({ phase: phaseProp, weather: weatherProp }: CloudBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const phase = phaseProp ?? getSkyPhase();
  // Clear unless something tells it otherwise. Nothing does today: this used to
  // be looked up over the network, and that lookup is gone.
  const weather = weatherProp ?? 'clear';
  const sky = phaseProp ? SKY[phaseProp] : getSkyPalette();
  const overcast = weather !== 'clear';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WatercolorSky sky={sky} phase={phase} overcast={overcast} />

      {/* stars, moon and falling weather stay crisp in front of the paint */}
      {phase === 'night' && <NightSky skyTop={sky.colors[1]} />}
      {weather === 'rain' &&
        Array.from({ length: 16 }, (_, i) => (
          <RainDrop key={i} index={i} screenW={width} screenH={height} />
        ))}
      {weather === 'snow' &&
        Array.from({ length: 18 }, (_, i) => (
          <SnowFlake key={i} index={i} screenW={width} screenH={height} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rainDrop: {
    position: 'absolute',
    width: 1.5,
    height: 16,
    borderRadius: 1,
    backgroundColor: 'rgba(190,205,235,0.55)',
  },
  snowFlake: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
