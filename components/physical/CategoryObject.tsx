import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useKnownTravelers } from '../../services/OnboardingService';
import { PDFCategory, PDFDocument } from '../../services/PDFService';
import { AddDocumentModal } from '../AddDocumentModal';
import {
  BoardingPassCover,
  FolderCover,
  InsuranceCard,
  PassportCover,
  VisaCover,
} from './Covers';
import { FanItem } from './FanItem';
import { PaperSheet, SHEET_HEIGHT, SHEET_WIDTH, TOSS_DISTANCE } from './PaperSheet';
import { TossBoundary } from './TossBoundary';

/** Sheets overlap slightly, like a fanned hand of papers */
const FAN_OVERLAP = -22;
/** Distance from one card's left edge to the next. */
const FAN_STEP = SHEET_WIDTH + FAN_OVERLAP;
/** Matches stackContent's horizontal padding. */
const FAN_PADDING = 16;
/** Sleeve inset (10) plus the old stack margin (6), reclaimed on both sides. */
const FAN_BLEED = 16;

/**
 * How far the fan's strip hangs past the interior, top and bottom.
 *
 * Enough that the edge it cuts cards off at — and so the line a card is thrown
 * away on — lands clear below the print that closes the object.
 */
const STRIP_OVERHANG = 30;
import { PhysicalObject, useOpenProgress } from './PhysicalObject';
import { getObjectType, OBJECT_SPECS, ObjectType } from './theme';

/** How much of the swing one sheet waits before it starts, and how long it takes. */
const RISE_STAGGER = 0.055;
const RISE_SPAN = 0.5;
/** Past this the stagger stops growing, so a thick folder still opens at once. */
const RISE_MAX_STEPS = 6;

/**
 * A sheet coming up out of the object as it opens.
 *
 * Reads the cover's own progress rather than running an entrance of its own, so
 * the papers rise on the same spring that swings the cover and land with it.
 * The offset per sheet is in progress, not milliseconds — it cannot drift out
 * of step with the swing however long the spring actually takes.
 */
function Rising({ index, children }: { index: number; children: React.ReactNode }) {
  const openP = useOpenProgress();
  const style = useAnimatedStyle(() => {
    const start = 0.12 + Math.min(index, RISE_MAX_STEPS) * RISE_STAGGER;
    const p = interpolate(
      openP.value,
      [start, start + RISE_SPAN],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 22 }],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

interface CategoryObjectProps {
  category: PDFCategory;
  onDocumentAdded: (document: PDFDocument) => void;
  onDocumentDeleted: (document: PDFDocument) => void;
  onViewDocument: (document: PDFDocument) => void;
  /** Fires whenever the object opens or shuts, however it was triggered. */
  onOpenChange?: (open: boolean) => void;
}

const COVER_BY_TYPE: Record<ObjectType, React.ComponentType<{ name: string; count: number }>> = {
  passport: PassportCover,
  boardingPass: BoardingPassCover,
  visa: VisaCover,
  insurance: InsuranceCard,
  folder: FolderCover,
};

export function CategoryObject({
  category,
  onDocumentAdded,
  onDocumentDeleted,
  onViewDocument,
  onOpenChange,
}: CategoryObjectProps) {
  const [open, setOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  /**
   * Built one frame before the cover starts moving, and kept from then on.
   *
   * Mounting the fan in the same commit that begins the swing put the cost of
   * every sheet — an animated style, a drawn surface and a shadow each — on the
   * animation's first frame, which is exactly where it is most visible. A frame
   * of delay before opening is not perceptible; a hitch at the start of the
   * motion is. Sheets sit at zero opacity until the swing reaches them, so
   * building them early shows nothing.
   */
  const [contentsMounted, setContentsMounted] = useState(false);

  // Watched rather than reported from the toggle: the object also shuts from
  // the seal and from a tap on the open surface, and a caller that learned
  // about one of those but not the others would be wrong half the time.
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setContentsMounted(true);
    requestAnimationFrame(() => setOpen(true));
  };

  const type = getObjectType(category);
  const spec = OBJECT_SPECS[type];
  const Cover = COVER_BY_TYPE[type];
  const { accent } = spec.interior;

  /**
   * Everyone this shelf could be filing for.
   *
   * The names given at onboarding are folded in with the ones already on
   * documents, so a brand-new shelf still offers chips to tap instead of an
   * empty field — and an empty traveller, which older documents can carry, is
   * dropped rather than shown as a blank chip.
   */
  const named = useKnownTravelers();
  const travelers = useMemo(
    () =>
      Array.from(new Set([...category.documents.map((d) => d.traveler), ...named]))
        .map((name) => name?.trim())
        .filter((name): name is string => !!name)
        .sort(),
    [category.documents, named]
  );

  const documents = category.documents;
  /**
   * With no surface behind them the tear notches have nothing to match, so they
   * become a soft light bite instead of a disc of paper colour, which would
   * read as a sticker sitting on the sky.
   */
  const notchFill = 'rgba(255,255,255,0.32)';

  /**
   * How far the card in the hand has been pulled toward being thrown away.
   *
   * One value for the whole fan rather than one per card: only one card can be
   * in a hand at a time, and the boundary it is being carried toward is the
   * same line for all of them.
   */
  const tossP = useSharedValue(0);

  const [interiorBox, setInteriorBox] = useState({ w: 0, h: 0 });

  /**
   * The strip runs past the interior, and the downward line sits on its edge.
   *
   * A scroll view clips to its bounds, so wherever the strip ends is where a
   * dragged card is cut off — a hard horizontal edge with nothing to explain
   * it. Upward that edge happens to fall inside the warning's own wash, which
   * is why it was never visible there. Downward it fell short of the line, so
   * the card was sliced in half well before reaching it.
   *
   * Putting the line exactly on the strip's edge makes the two the same line:
   * the card is cut where the card is thrown away. The strip is stretched past
   * the interior first, so that line clears the print that closes the object.
   */
  const stripH = interiorBox.h > 0 ? interiorBox.h + STRIP_OVERHANG * 2 : SHEET_HEIGHT + 116;
  const tossDown = Math.max(TOSS_DISTANCE, stripH / 2);
  // Out to the sides of the phone, from wherever the interior's edges are.
  const tossBleed = Math.max(0, (Dimensions.get('window').width - interiorBox.w) / 2);

  // Drives the fade at each end of the fan.
  const fanScrollX = useSharedValue(0);
  const fanViewport = useSharedValue(0);
  const onFanScroll = useAnimatedScrollHandler((e) => {
    fanScrollX.value = e.contentOffset.x;
  });
  const interior = (
    <View
      style={styles.interior}
      onLayout={(e) =>
        setInteriorBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {/* Only books draw a surface — you turn pages against it. In a sleeve the
          documents are the object, so the cards are left floating. */}

      {/* the open surface itself puts the object away */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />

      {/* Books page through their documents like a real passport */}
      {/* Scrollable fan: few sheets sit centered, many sheets breathe and
          scroll sideways instead of piling up. Vertical pulls still lift
          and toss a sheet; horizontal swipes move along the fan. */}
      {contentsMounted && (
        <View style={[styles.stackFrame, { height: stripH }]}>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onFanScroll}
            onLayout={(e) => {
              fanViewport.value = e.nativeEvent.layout.width;
            }}
            style={[styles.stack, { height: stripH }]}
            contentContainerStyle={styles.stackContent}
          >
            {documents.map((doc, i) => (
              <FanItem
                key={doc.id}
                offset={FAN_PADDING + i * FAN_STEP}
                width={SHEET_WIDTH}
                scrollX={fanScrollX}
                viewport={fanViewport}
                style={{
                  zIndex: i + 1,
                  marginLeft: i === 0 ? 0 : FAN_OVERLAP,
                  transform: [
                    { rotate: `${i % 2 === 0 ? -2 : 2}deg` },
                    { translateY: i % 2 === 0 ? -3 : 3 },
                  ],
                }}
              >
                <Rising index={i}>
                  <PaperSheet
                    document={doc}
                    accent={accent}
                    gradient={spec.interior.gradient}
                    paper={notchFill}
                    variant={type === 'passport' ? 'passport' : 'ticket'}
                    toss={tossP}
                    tossDown={tossDown}
                    onView={onViewDocument}
                    onDelete={onDocumentDeleted}
                  />
                </Rising>
              </FanItem>
            ))}

            {/* a blank sheet waiting to be filled */}
            <View
              style={{
                zIndex: documents.length + 1,
                marginLeft: documents.length === 0 ? 0 : FAN_OVERLAP,
              }}
            >
              <Rising index={documents.length}>
                <Pressable
                  onPress={() => setShowAddModal(true)}
                  style={({ pressed }) => [styles.ghostSheet, pressed && { transform: [{ scale: 0.96 }] }]}
                >
                  {/* Drawn rather than bordered. iOS renders a dashed border on a
                      square path and drops the radius with it, so the sheet came
                      out with hard corners however it was rounded. A stroked rect
                      dashes and rounds at the same time. */}
                  <Svg width={SHEET_WIDTH} height={SHEET_HEIGHT} style={StyleSheet.absoluteFill}>
                    <Rect
                      x={0.75}
                      y={0.75}
                      width={SHEET_WIDTH - 1.5}
                      height={SHEET_HEIGHT - 1.5}
                      rx={GHOST_RADIUS}
                      ry={GHOST_RADIUS}
                      fill="none"
                      stroke={accent}
                      strokeWidth={1.5}
                      strokeDasharray="7 5"
                    />
                  </Svg>
                  <Ionicons name="add" size={24} color={accent} />
                  <Text style={[styles.ghostText, { color: accent }]}>Add Document</Text>
                </Pressable>
              </Rising>
            </View>
          </Animated.ScrollView>
        </View>
      )}

      {/* Over the whole interior rather than over the strip, and out past it on
          every side: the boundary belongs to the screen, and the downward line
          has to clear the foot of the object. Drawn before the print below so
          the print stays on top of it. */}
      <TossBoundary progress={tossP} up={TOSS_DISTANCE} down={tossDown} bleed={tossBleed} />

      {/* Closing used to rely on knowing the whole surface was tappable, which
          nothing on screen said. A print to press is both the affordance and
          the instruction. */}
      <TouchableOpacity
        style={styles.closeSeal}
        onPress={() => setOpen(false)}
        activeOpacity={0.6}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel={`Close ${category.name}`}
      >
        <Ionicons name="finger-print" size={20} color={accent} />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <PhysicalObject
        spec={spec}
        open={open}
        floating
        onToggle={toggle}
        cover={
          type === 'folder' && category.id !== 'other' ? (
            <FolderCover
              name={category.name}
              count={category.documents.length}
              tint={category.accentColor}
            />
          ) : (
            <Cover name={category.name} count={category.documents.length} />
          )
        }
        interior={interior}
      />
      <AddDocumentModal
        visible={showAddModal}
        categoryId={category.id}
        categoryName={category.name}
        accent={accent}
        onClose={() => setShowAddModal(false)}
        onDocumentAdded={(doc) => {
          onDocumentAdded(doc);
          setShowAddModal(false);
        }}
        existingTravelerNames={travelers}
      />
    </>
  );
}

/** Corner radius shared by the ghost sheet's fill and its drawn outline. */
const GHOST_RADIUS = 16;

const styles = StyleSheet.create({
  interior: {
    flex: 1,
    justifyContent: 'center',
  },
  chrome: {
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  /**
   * Holds the strip and the toss boundary in one box.
   *
   * The boundary hangs off this frame's middle, so the frame has to be exactly
   * the strip: same height, same bleed. Anything else and the line would be
   * drawn at a distance the gesture does not actually arm at.
   */
  stackFrame: {
    alignSelf: 'stretch',
    height: SHEET_HEIGHT + 116,
    // Breaks out past the sleeve and the carousel's padding so the strip is as
    // wide as the screen. The clip boundary is then the edge of the phone,
    // which is where a card should vanish — not part-way in, while there is
    // still room to show it.
    marginHorizontal: -FAN_BLEED,
  },
  stack: {
    flexGrow: 0,
    alignSelf: 'stretch',
    // Generous headroom: a scroll view clips to its bounds, so the card's tilt,
    // drop shadow, entrance scale and the lift while dragging all need to fit
    // inside or they get sliced off against the top edge.
    height: SHEET_HEIGHT + 116,
  },
  stackContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ghostSheet: {
    width: SHEET_WIDTH,
    height: SHEET_HEIGHT,
    // the outline is the Svg above; this only rounds the fill beneath it
    borderRadius: GHOST_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.35)',
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
  closeSeal: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
