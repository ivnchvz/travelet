import * as Haptics from 'expo-haptics';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CLOSE_SPRING, OPEN_SPRING, PRESS_SPRING, SETTLE_SPRING, SHADOW_OBJECT, SHADOW_SURFACE } from './motion';
import { ObjectSpec } from './theme';

/**
 * How far this object has swung open, 0 shut to 1 flat.
 *
 * Published so the interior can move on the same value the cover does. The
 * contents used to arrive on their own entrance animations, which ran on their
 * own clocks — with a full fan the last sheet had not started by the time the
 * cover finished, so opening read as two events with a gap between them. One
 * value driving both makes it a single motion, and makes it interruptible:
 * closing halfway through now reverses everything together instead of leaving
 * entrances to play themselves out.
 */
const OpenProgress = createContext<SharedValue<number> | null>(null);

export function useOpenProgress(): SharedValue<number> {
  // A cover-less caller still needs a value to read; a static 1 means "open",
  // which is the right answer for anything rendered outside an object.
  const standalone = useSharedValue(1);
  return useContext(OpenProgress) ?? standalone;
}

interface PhysicalObjectProps {
  spec: ObjectSpec;
  open: boolean;
  onToggle: () => void;
  cover: ReactNode;
  interior: ReactNode;
  /**
   * Drops the open surface's shadow. Set when the interior draws nothing of its
   * own — a shadow with no visible surface casting it reads as a stray
   * rectangle floating behind the contents.
   */
  floating?: boolean;
  /**
   * Keeps the interior on screen while the object is shut.
   *
   * Normally it fades in as the cover lifts — there's no point rendering pages
   * nobody can see. A translucent cover changes that: the whole point is
   * reading what's underneath before opening it, and there is nothing to read
   * if the interior is at zero opacity behind the glass.
   */
  revealInterior?: boolean;
}


/**
 * The angles either side of perpendicular over which the two faces swap.
 *
 * Kept in degrees, not progress, so it always straddles the edge-on point
 * however far a given object opens. Widened from twelve degrees: the swing is
 * at its fastest here, and twelve went by in a frame or two, which read as the
 * cover snapping rather than turning.
 */
const FACE_TURN: readonly [number, number] = [78, 102];

function triggerOpenHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

function triggerDragHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
  }
}

/**
 * Wraps a "physical" cover + interior pair.
 * Closed: the cover can be dragged around (with 3D tilt) and tapped to open.
 * Open: the cover swings away on its hinge, revealing the interior.
 */
export function PhysicalObject({ spec, open, onToggle, cover, interior, floating = false, revealInterior = false }: PhysicalObjectProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pressed = useSharedValue(0);
  const idle = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const openP = useSharedValue(0);
  useEffect(() => {
    openP.value = withSpring(open ? 1 : 0, open ? OPEN_SPRING : CLOSE_SPRING);
  }, [open, openP]);

  // While opening, the cover glides so its hinge lands exactly on the opened
  // object: book spines and wallet stitches at the center, flaps at the edge.
  const coverW = containerWidth * spec.widthPct;
  const coverH = coverW / spec.aspect;
  const openW = containerWidth * spec.open.widthPct;
  const openH = openW / spec.open.aspect;
  const hingeShiftX =
    spec.hinge === 'left'
      ? spec.hingeAnchor === 'center'
        ? coverW / 2
        : -(openW - coverW) / 2
      : 0;
  const hingeShiftY =
    spec.hinge === 'top'
      ? spec.hingeAnchor === 'center'
        ? coverH / 2
        : -(openH - coverH) / 2
      : 0;

  // Gentle levitation, slightly out of phase per object — calm, not bouncy
  useEffect(() => {
    idle.value = withDelay(
      Math.round(Math.random() * 1400),
      withRepeat(
        withTiming(1, { duration: 3300, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
  }, [idle]);

  const handleToggle = () => {
    triggerOpenHaptic();
    onToggle();
  };

  const pan = Gesture.Pan()
    .enabled(!open)
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onBegin(() => {
      runOnJS(triggerDragHaptic)();
    })
    .onChange((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.5;
    })
    .onFinalize(() => {
      tx.value = withSpring(0, SETTLE_SPRING);
      ty.value = withSpring(0, SETTLE_SPRING);
    });

  const tap = Gesture.Tap()
    .enabled(!open)
    .onBegin(() => {
      pressed.value = withSpring(1, PRESS_SPRING);
    })
    .onFinalize((_e, success) => {
      pressed.value = withSpring(0, SETTLE_SPRING);
      if (success) {
        runOnJS(handleToggle)();
      }
    });

  const gesture = Gesture.Race(pan, tap);

  // Books hand the flattened cover off to the endpaper painted by the
  // interior, so interior content (turned pages) can sit on top of it.
  const isBook = spec.hingeAnchor === 'center' && spec.hinge === 'left';

  const coverStyle = useAnimatedStyle(() => {
    const openDeg = openP.value * spec.openDeg;
    const tiltY = interpolate(tx.value, [-160, 160], [-13, 13], Extrapolation.CLAMP);
    const tiltX = interpolate(ty.value, [-120, 120], [9, -9], Extrapolation.CLAMP);
    const lean = interpolate(tx.value, [-160, 160], [-3.5, 3.5], Extrapolation.CLAMP);
    const scale = 1 - pressed.value * 0.03;
    // Idle float is translation-only: rotating/scaling text every frame makes
    // iOS resample the rasterized layer and the cover turns fuzzy.
    const idleLift = (idle.value - 0.5) * 5 * (1 - openP.value);

    const hingeRotation =
      spec.hinge === 'left'
        ? { rotateY: `${-openDeg + tiltY}deg` }
        : { rotateX: `${openDeg + tiltX}deg` };
    const crossTilt =
      spec.hinge === 'left' ? { rotateX: `${tiltX}deg` } : { rotateY: `${tiltY}deg` };

    return {
      // Fades out over the last of the swing: once the object is open the cover
      // has nothing left to say, and leaving it on screen crowds the interior
      // and steals room from the documents.
      //
      // A book is exempt. It already disposes of its cover by handing off to
      // the endpaper, and running this fade as well meant the cover ghosted
      // away from 0.72 while the handoff was still waiting at 0.92 — two fades
      // over the same object, which is what made opening a passport mushy
      // where the others snap. The handoff alone is the cleaner statement.
      opacity: isBook
        ? 1
        : interpolate(openP.value, [0.72, 0.97], [1, 0], Extrapolation.CLAMP),
      transform: [
        { perspective: 1400 },
        { translateX: tx.value + hingeShiftX * openP.value },
        { translateY: ty.value + idleLift + hingeShiftY * openP.value },
        hingeRotation,
        crossTilt,
        { rotateZ: `${lean}deg` },
        { scale },
      ],
    };
  });

  // The interior materializes with the lift and settles onto the table
  const interiorStyle = useAnimatedStyle(() => ({
    opacity: revealInterior
      ? 1
      : interpolate(openP.value, [0.05, 0.45], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: revealInterior
          ? 1
          : interpolate(openP.value, [0, 0.7], [0.93, 1], Extrapolation.CLAMP),
      },
      {
        translateY: revealInterior
          ? 0
          : interpolate(openP.value, [0, 1], [6, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  // RN's backfaceVisibility ignores the parent's rotation, so crossfade the
  // two faces ourselves — keyed to the actual hinge angle (90° is the
  // perpendicular point regardless of how far this object opens).
  const frontFaceStyle = useAnimatedStyle(() => {
    const deg = openP.value * spec.openDeg;
    return { opacity: interpolate(deg, FACE_TURN, [1, 0], Extrapolation.CLAMP) };
  });
  const backFaceStyle = useAnimatedStyle(() => {
    const deg = openP.value * spec.openDeg;
    const crossfade = interpolate(deg, FACE_TURN, [0, 1], Extrapolation.CLAMP);
    const handoff = isBook
      ? interpolate(openP.value, [0.92, 1], [1, 0], Extrapolation.CLAMP)
      : 1;
    return { opacity: crossfade * handoff };
  });

  const backFaceRotation =
    spec.hinge === 'left' ? { rotateY: '180deg' } : { rotateX: '180deg' };

  return (
    <View
      style={styles.root}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.fill, styles.center]} pointerEvents="box-none">
        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          style={[
            {
              width: `${spec.open.widthPct * 100}%`,
              aspectRatio: spec.open.aspect,
            },
            floating ? null : SHADOW_SURFACE,
            interiorStyle,
          ]}
        >
          <OpenProgress.Provider value={openP}>{interior}</OpenProgress.Provider>
        </Animated.View>
      </View>

      <View style={[styles.fill, styles.center]} pointerEvents="box-none">
        <GestureDetector gesture={gesture}>
          <Animated.View
            pointerEvents={open ? 'none' : 'auto'}
            style={[
              {
                width: `${spec.widthPct * 100}%`,
                aspectRatio: spec.aspect,
                transformOrigin: spec.hinge === 'left' ? 'left center' : 'center top',
              },
              SHADOW_OBJECT,
              coverStyle,
            ]}
          >
            <Animated.View style={[styles.face, { borderRadius: spec.radius }, frontFaceStyle]}>
              {cover}
            </Animated.View>
            <Animated.View
              style={[
                styles.face,
                styles.faceBack,
                {
                  borderRadius: spec.radius,
                  backgroundColor: spec.coverBack,
                  transform: [backFaceRotation],
                },
                backFaceStyle,
              ]}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  // RN evaluates backfaceVisibility against the view's own transform only —
  // this face is statically rotated 180°, so 'hidden' would never show it.
  // The opacity crossfade above handles its visibility instead.
  faceBack: {
    backfaceVisibility: 'visible',
  },
});
