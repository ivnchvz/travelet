import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PDFDocument } from '../../services/PDFService';
import { CAPTION, SETTLE_SPRING } from './motion';
import { PaperSheet } from './PaperSheet';
import { Texture } from './Texture';

const PAGE_CREAM = '#f6efdf';
const TURN_THRESHOLD = 0.35;
const TURN_COMPLETE = { duration: 280, easing: Easing.out(Easing.cubic) };

type PageItem = { type: 'doc'; doc: PDFDocument } | { type: 'add' };

interface PassportPagesProps {
  documents: PDFDocument[];
  accent: string;
  onView: (doc: PDFDocument) => void;
  onDelete: (doc: PDFDocument) => void;
  onAdd: () => void;
}

function pageHaptic() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

/** The back of a turned page: plain cream, shaded toward the spine. */
function PageBack({ spineSide }: { spineSide: 'left' | 'right' }) {
  return (
    <View style={s.pageBack}>
      <Texture variant="paper" opacity={0.4} />
      <LinearGradient
        colors={
          spineSide === 'right'
            ? ['rgba(90,70,50,0)', 'rgba(90,70,50,0.14)']
            : ['rgba(90,70,50,0.14)', 'rgba(90,70,50,0)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** One passport page holding a single document (or the blank add sheet). */
function PageFace({
  item,
  pageNo,
  total,
  accent,
  onView,
  onDelete,
  onAdd,
}: {
  item: PageItem;
  pageNo: number;
  total: number;
  accent: string;
  onView: (doc: PDFDocument) => void;
  onDelete: (doc: PDFDocument) => void;
  onAdd: () => void;
}) {
  return (
    <View style={s.pageFace}>
      <Texture variant="paper" opacity={0.5} />
      {/* shading that falls into the spine */}
      <LinearGradient
        colors={['rgba(90,70,50,0.16)', 'rgba(90,70,50,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {pageNo % 2 === 0 ? (
        <View style={[s.stamp, { top: 12, right: 12, transform: [{ rotate: '12deg' }] }]}>
          <Text style={s.stampText}>IMMIGRATION</Text>
        </View>
      ) : (
        <View style={[s.stamp, { top: 14, right: 16, borderRadius: 30, transform: [{ rotate: '-9deg' }] }]}>
          <Text style={s.stampText}>ADMITTED</Text>
        </View>
      )}

      <View style={s.pageContent}>
        {item.type === 'doc' ? (
          <PaperSheet document={item.doc} accent={accent} onView={onView} onDelete={onDelete} />
        ) : (
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [s.ghostSheet, { borderColor: accent }, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <Ionicons name="add" size={24} color={accent} />
            <Text style={[s.ghostText, { color: accent }]}>Add Document</Text>
          </Pressable>
        )}
      </View>

      <Text style={s.pageNo}>
        {pageNo + 1} of {total}
      </Text>
      {/* curled corner: there's another page under this one */}
      {pageNo < total - 1 && <View style={s.dogEar} />}
    </View>
  );
}

/**
 * The passport's right side as a stack of turnable pages — swipe left to
 * peel the page over the spine and uncover the next document, swipe right
 * to leaf back. Turned pages pile up on the inside cover.
 */
export function PassportPages({ documents, accent, onView, onDelete, onAdd }: PassportPagesProps) {
  const [index, setIndex] = useState(0);
  const [pageW, setPageW] = useState(1);
  const turn = useSharedValue(0); // forward: current page lifting toward the left
  const back = useSharedValue(0); // backward: previous page returning to the right

  const items: PageItem[] = [
    ...documents.map((doc) => ({ type: 'doc' as const, doc })),
    { type: 'add' as const },
  ];
  const total = items.length;

  // documents can be tossed away while a later page is open
  useEffect(() => {
    if (index > total - 1) setIndex(total - 1);
  }, [index, total]);

  const advance = (dir: 1 | -1) => {
    pageHaptic();
    setIndex((i) => Math.max(0, Math.min(total - 1, i + dir)));
  };

  // Reset the turn AFTER the new index has committed but BEFORE it paints —
  // resetting inside advance() leaves a frame where the old page snaps back.
  useLayoutEffect(() => {
    turn.value = 0;
    back.value = 0;
  }, [index, turn, back]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onChange((e) => {
      if (e.translationX < 0 && index < total - 1 && back.value === 0) {
        turn.value = Math.min(1, -e.translationX / pageW);
      } else if (e.translationX > 0 && index > 0 && turn.value === 0) {
        back.value = Math.min(1, e.translationX / pageW);
      }
    })
    .onEnd((e) => {
      if (turn.value > 0) {
        if (turn.value > TURN_THRESHOLD || e.velocityX < -400) {
          turn.value = withTiming(1, TURN_COMPLETE, (finished) => {
            if (finished) runOnJS(advance)(1);
          });
        } else {
          turn.value = withSpring(0, SETTLE_SPRING);
        }
      } else if (back.value > 0) {
        if (back.value > TURN_THRESHOLD || e.velocityX > 400) {
          back.value = withTiming(1, TURN_COMPLETE, (finished) => {
            if (finished) runOnJS(advance)(-1);
          });
        } else {
          back.value = withSpring(0, SETTLE_SPRING);
        }
      }
    });

  // forward-turning page (front: current doc; back: cream)
  const flipStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${-180 * turn.value}deg` }],
  }));
  const flipFrontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turn.value, [0.48, 0.52], [1, 0], Extrapolation.CLAMP),
  }));
  const flipBackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turn.value, [0.48, 0.52], [0, 1], Extrapolation.CLAMP),
  }));

  // backward-turning page (returns from the left pile)
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${-180 + 180 * back.value}deg` }],
  }));
  const backFrontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(back.value, [0.48, 0.52], [0, 1], Extrapolation.CLAMP),
  }));
  const backBackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(back.value, [0.48, 0.52], [1, 0], Extrapolation.CLAMP),
  }));

  // the current page hides while its flying copy is animating
  const currentStyle = useAnimatedStyle(() => ({
    opacity: turn.value > 0.01 ? 0 : 1,
  }));

  // the pile lifts away when the last turned page flies back
  const pileStyle = useAnimatedStyle(() => ({
    opacity: index > 1 ? 1 : back.value > 0.01 ? 0 : index > 0 ? 1 : 0,
  }));

  return (
    <View style={s.root} pointerEvents="box-none">
      {/* pile of already-turned pages, resting on the inside cover */}
      <Animated.View style={[s.leftPage, pileStyle]} pointerEvents="none">
        <PageBack spineSide="right" />
        <View style={[s.pileEdge, { right: 3 }]} />
        <View style={[s.pileEdge, { right: 6 }]} />
      </Animated.View>

      {/* a page coming back from the pile */}
      {index > 0 && (
        <Animated.View style={[s.flipPage, backStyle]} pointerEvents="none">
          <Animated.View style={[s.face, backFrontStyle]}>
            <PageFace
              item={items[index - 1]}
              pageNo={index - 1}
              total={total}
              accent={accent}
              onView={onView}
              onDelete={onDelete}
              onAdd={onAdd}
            />
          </Animated.View>
          <Animated.View style={[s.face, backBackStyle]}>
            <PageBack spineSide="right" />
          </Animated.View>
        </Animated.View>
      )}

      {/* right side: the open page (and the next one beneath it) */}
      <GestureDetector gesture={pan}>
        <View style={s.rightPage} onLayout={(e) => setPageW(Math.max(1, e.nativeEvent.layout.width))}>
          {index < total - 1 && (
            <View style={StyleSheet.absoluteFill}>
              <PageFace
                item={items[index + 1]}
                pageNo={index + 1}
                total={total}
                accent={accent}
                onView={onView}
                onDelete={onDelete}
                onAdd={onAdd}
              />
            </View>
          )}
          <Animated.View style={[StyleSheet.absoluteFill, currentStyle]}>
            <PageFace
              item={items[index]}
              pageNo={index}
              total={total}
              accent={accent}
              onView={onView}
              onDelete={onDelete}
              onAdd={onAdd}
            />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* the page mid-turn, flying over the spine */}
      <Animated.View style={[s.flipPage, flipStyle]} pointerEvents="none">
        <Animated.View style={[s.face, flipFrontStyle]}>
          <PageFace
            item={items[index]}
            pageNo={index}
            total={total}
            accent={accent}
            onView={onView}
            onDelete={onDelete}
            onAdd={onAdd}
          />
        </Animated.View>
        <Animated.View style={[s.face, flipBackStyle]}>
          <PageBack spineSide="left" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  leftPage: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    overflow: 'hidden',
  },
  pileEdge: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 1,
    backgroundColor: 'rgba(90,70,50,0.18)',
  },
  rightPage: {
    position: 'absolute',
    left: '50%',
    right: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  flipPage: {
    position: 'absolute',
    left: '50%',
    width: '50%',
    top: 0,
    bottom: 0,
    transformOrigin: 'left center',
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: 4,
  },
  pageFace: {
    flex: 1,
    backgroundColor: PAGE_CREAM,
  },
  pageBack: {
    flex: 1,
    backgroundColor: PAGE_CREAM,
  },
  pageContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNo: {
    position: 'absolute',
    bottom: 7,
    alignSelf: 'center',
    ...CAPTION,
    fontSize: 10,
    color: 'rgba(90,70,50,0.5)',
  },
  dogEar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    borderBottomWidth: 16,
    borderLeftWidth: 16,
    borderBottomColor: 'rgba(90,70,50,0.14)',
    borderLeftColor: 'transparent',
  },
  stamp: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 8,
    borderColor: 'rgba(30,90,160,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stampText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(30,90,160,0.22)',
  },
  ghostSheet: {
    width: 134,
    height: 168,
    borderRadius: 16,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },
});
