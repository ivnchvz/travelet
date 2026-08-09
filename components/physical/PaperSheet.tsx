import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { findCountry } from '../../services/Countries';
import { useHomeCountry } from '../../services/OnboardingService';
import { PDFDocument } from '../../services/PDFService';
import Svg, {
  Circle as SvgCircle,
  ClipPath,
  Defs,
  G,
  Path as SvgPath,
  Rect as SvgRect,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';
import { PRESS_SPRING, SETTLE_SPRING, SHADOW_SHEET } from './motion';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassLayers } from './GlassLayers';
import { Perforation } from './Perforation';
import { Texture } from './Texture';
import { TossConfirm } from './TossConfirm';
import { WorldDots } from './WorldDots';

const TEAR_NOTCH = 16;

/** The passport card's own corners: bound on the spine, rounded on the free edge. */
const BOOK_SPINE_RADIUS = 5;
const BOOK_EDGE_RADIUS = 20;


/**
 * Concentric corners for the page window.
 *
 * A rounded corner only looks like it belongs inside another when the two arcs
 * stay a constant distance apart, and that means the inner radius is the outer
 * one *less the inset* — not the same number. Copying the card's radii straight
 * across would leave the window's curve tightening away from the card's instead
 * of running parallel to it.
 */
/**
 * The page's own grid, in card units — the sheet is a fixed size, so these are
 * points on it rather than fractions of it.
 *
 * The form is a printed blank, and the only thing entered on it is a name. That
 * is deliberate: everything else this app could put on these lines — a
 * nationality, a document number, a description — would be invented, and a card
 * covered in plausible particulars about its holder is a forgery of a small
 * one. A blank that was only ever half filled in is both honest and, going by
 * the references, more like the real thing.
 */
const PAGE = {
  m: 12,
  /** The printed frame the whole form sits inside. */
  frame: { x: 8, y: 8, w: 196, h: 262, r: 14 },
  /** The rule under the heading. */
  head: 21,
  /** The photograph — here, the page of the document itself. */
  photo: { x: 12, y: 27, w: 120, h: 156 },
  /** The description, in the column beside the photograph. Never filled in. */
  right: { x: 139, w: 61, rows: [52, 74, 96, 118, 140, 162] },
  /** Where the card was folded in a wallet for years. */
  fold: 192,
  /**
   * The one line anybody wrote on.
   *
   * Everything below the fold is set the way the cover is — a name at weight,
   * a hairline, a band of the same halftone world, and nothing else. The top
   * of the card is a printed form and stays fussy; the bottom is the object
   * this app actually is, and the two registers sitting either side of the
   * crease is the point rather than an inconsistency.
   */
  name: { caption: 197, value: 203, rule: 224 },
  /**
   * The world again — the cover's own mark, on the leaf inside it.
   *
   * Kept near the proportion the cover crops its map to. The dots scale to
   * cover their box and crop what falls outside, so a long thin band would
   * throw away the latitudes the lit country is likely to be at, and the one
   * dot the map exists to show would be the first thing gone.
   */
  dots: { x: 12, y: 230, w: 74, h: 40 },
  print: { x: 130, y: 230, w: 70, h: 40 },
  /** The imprint sits below the frame, where a printer's line goes. */
  foot: 274,
  /** The revenue label, stuck across the photograph's edge. */
  revenue: { x: 112, y: 38, w: 34, h: 46 },
  // Where they landed and how they sat; what colour they were is the card's
  // own business, and comes from `sealInks`.
  seals: [
    { cx: 106, cy: 152, r: 28, tilt: -11 },
    { cx: 58, cy: 238, r: 20, tilt: 7 },
  ],
};

/**
 * A fingerprint, as ridges rather than as rings.
 *
 * Concentric ellipses are what a fingerprint looks like from memory; what one
 * actually looks like is a loop — a family of ridges that wrap a core, open at
 * the foot, and meet a delta off to one side where they part to run round it.
 * The ridges also stop and start. A print is ink pressed off skin, so it comes
 * out broken, heavier where the finger bore down and missing where it didn't,
 * and unbroken lines are the tell that gives a drawn one away.
 *
 * Built once at module load: it is the same print on every card, and this is a
 * few hundred bytes of path data against doing the trigonometry per card in a
 * fan that has to stay smooth while it opens.
 */
function buildPrint(box: { x: number; y: number; w: number; h: number }) {
  const cx = box.x + box.w * 0.47;
  const cy = box.y + box.h * 0.44;

  const ridges: { d: string; dash: string; alpha: number }[] = [];

  // The loop itself: nested arches around the core, each drifting a little to
  // the right and opening wider at the foot, so the family leans the way a
  // real loop does instead of sitting square. Everything is a fraction of the
  // box, so the print fits whatever square the form gives it and spills over
  // the edges by the same margin either way.
  for (let i = 0; i < 12; i++) {
    const rx = box.w * (0.035 + i * 0.039);
    const ry = box.h * (0.06 + i * 0.068);
    const drift = i * box.w * 0.006;
    const left = cx - rx + drift * 0.35;
    const right = cx + rx + drift;
    const foot = cy + ry * 0.92;
    const top = cy - ry;
    ridges.push({
      d: `M ${left.toFixed(1)} ${foot.toFixed(1)} C ${left.toFixed(1)} ${(top - ry * 0.2).toFixed(1)} ${right.toFixed(1)} ${(top - ry * 0.2).toFixed(1)} ${right.toFixed(1)} ${foot.toFixed(1)}`,
      // Every ridge breaks differently. The numbers are arbitrary but fixed —
      // the same print each time, not a new one on every render.
      dash: [
        `${18 + i * 3} ${2 + (i % 3)} ${9 + i} ${1.5}`,
        `${26 + i * 2} ${1.5} ${14 + i * 2} ${2.5}`,
        `${11 + i} ${2} ${31 + i * 3} ${1.8}`,
      ][i % 3],
      alpha: 0.34 - (i % 4) * 0.035,
    });
  }

  // The delta: where the ridges coming up from the foot split around the loop.
  // Three short arcs converging is enough to read as one at this size.
  const dx = cx - box.w * 0.3;
  const dy = cy + box.h * 0.2;
  for (let i = 0; i < 4; i++) {
    const k = i * 1.9;
    ridges.push({
      d: `M ${(dx - 9 - k).toFixed(1)} ${(dy + 7 + k).toFixed(1)} Q ${(dx - k * 0.4).toFixed(1)} ${(dy - k * 0.5).toFixed(1)} ${(dx + 8 + k).toFixed(1)} ${(dy + 6 + k * 1.2).toFixed(1)}`,
      dash: `${9 + i * 3} ${1.6} ${6 + i} ${1.4}`,
      alpha: 0.3 - i * 0.03,
    });
  }

  return { ridges, cx, cy };
}

const PRINT = buildPrint(PAGE.print);

/** The description block's captions — printed, and left blank. */
const PAGE_DESCRIPTION = ['Height', 'Hair', 'Eyes', 'Complexion', 'Nose', 'Marks'];

/** The typewriter the form was filled in on. */
const MONO = 'SpaceMono';

/** The form's own ink, and the rules it was ruled with. */
const PAGE_PRINT = 'rgba(58,50,40,0.62)';
const PAGE_RULE = 'rgba(67,57,44,0.34)';
const PAGE_REVENUE = 'rgba(196,92,110,0.72)';


export const SHEET_WIDTH = 212;
export const SHEET_HEIGHT = 286;

/**
 * Dragging a sheet further than this and letting go means "toss it out".
 *
 * Exported because the boundary is now drawn: the line the fan puts across
 * itself has to be at exactly the distance the gesture actually arms at, or
 * the cue is a lie.
 */
export const TOSS_DISTANCE = 172;

interface PaperSheetProps {
  document: PDFDocument;
  accent: string;
  /** Multi-stop tint for the glass; falls back to the flat accent. */
  gradient?: string[];
  /** Colour behind the card, shown through the tear notches. */
  paper?: string;
  /** A ticket tears and carries a code; a passport doesn't. */
  variant?: 'ticket' | 'passport';
  /**
   * How far this sheet has been pulled toward being thrown away, as a signed
   * fraction of `TOSS_DISTANCE` — negative up, positive down, 0 at rest.
   *
   * Shared with the fan rather than kept here, because the boundary belongs to
   * the fan: every card rests on the same line, so one drawn boundary serves
   * whichever card is in the hand, and a card cannot draw the edge it is
   * being carried away from anyway.
   */
  toss?: SharedValue<number>;
  /**
   * How far down the boundary was drawn, when that is not the same as how far
   * up. The print that closes an object sits at the foot of the interior, so
   * the downward line is put below it and the gesture has to agree.
   */
  tossDown?: number;
  onView: (document: PDFDocument) => void;
  onDelete: (document: PDFDocument) => void;
}

function hapticSelect() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

/**
 * A shade for each passport, derived from the document's own id.
 *
 * Real passports differ by issuing country, so a stack of identical cards reads
 * wrong. The swing is deliberately narrow — a little either side of the same
 * burgundy — so the cards still look like one set rather than five unrelated
 * colours. Keyed on the id rather than the position in the fan, so a card keeps
 * its shade when others are added or tossed out around it.
 */
/**
 * FNV-1a with an avalanche step.
 *
 * Ids are timestamps, so neighbouring documents differ in one digit; a weaker
 * hash would land them on nearly the same value and every card in a fan would
 * come out looking alike, which is the whole thing this is here to avoid.
 */
function hashId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519);
  return (hash ^ (hash >>> 13)) >>> 0;
}

/**
 * The inks an office had on the shelf.
 *
 * Real ones, and a short list: a bureau bought pads, not a spectrum. Violet
 * aniline is the classic — it was the cheapest dye and it is why so much old
 * paperwork is stamped purple — with red for anything that mattered, blue-black
 * where a fountain-pen ink was decanted into the pad, and green and sepia
 * turning up on the odd department's stamp.
 */
const SEAL_INKS = [
  '150,46,44', // stamp red
  '88,66,136', // violet aniline
  '42,58,104', // blue-black
  '46,88,72', // green
  '118,72,42', // sepia
  '122,44,86', // magenta-violet
];

/**
 * Which two inks this card was stamped with.
 *
 * A stack of cards all stamped in the same red reads as printed rather than
 * collected, and the two stamps on one card were rarely the same pad either —
 * so the second is picked to be a different ink from the first, not merely a
 * different roll of the dice that might land on the same one.
 */
function sealInks(id: string): [string, string] {
  const hash = hashId(id);
  const first = (hash >>> 3) % SEAL_INKS.length;
  const step = 1 + ((hash >>> 11) % (SEAL_INKS.length - 1));
  return [SEAL_INKS[first], SEAL_INKS[(first + step) % SEAL_INKS.length]];
}

function bookGradient(id: string): readonly [string, string, string] {
  const hash = hashId(id);

  /**
   * Aged page stock, one shade per card.
   *
   * The cover is grey board and these are the leaves inside it — in a real
   * passport those are not the same material, and making them match was the
   * wrong kind of coherence. Paper yellows unevenly, so the variation that
   * keeps a stack from looking printed twice now reads as age rather than as a
   * different colour of card.
   */
  const hue = 38 + ((hash % 13) - 6);
  const sat = 22 + ((hash >>> 7) % 10);
  const lum = ((hash >>> 13) % 7) - 3;

  return [
    `hsl(${hue}, ${sat}%, ${89 + lum}%)`,
    `hsl(${hue - 1}, ${sat}%, ${82 + lum}%)`,
    `hsl(${hue - 3}, ${sat + 2}%, ${74 + lum}%)`,
  ];
}

function hapticImpact() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * A rubber handstamp.
 *
 * The shape of the thing is the wording bent round the rim with a straight
 * band across the middle for the date — that arrangement is what makes a ring
 * of ink read as a stamp rather than as a circle drawn on a card. Two rings
 * and a bar, which is what was here before, reads as neither.
 *
 * The ink is broken on purpose. A rubber stamp is pressed by hand onto paper
 * that is not flat, so it prints heavy on one side, thin on the other, and
 * missing where the card dipped away from it. An even ring is the giveaway.
 */
function Seal({
  seal,
  id,
  ink: rgb,
  top,
  bottom,
  date,
}: {
  seal: (typeof PAGE.seals)[number];
  id: string;
  /** The pad it was pressed on, as "r,g,b". */
  ink: string;
  /** Curved along the rim above; omitted for a plain control stamp. */
  top?: string;
  bottom?: string;
  date?: string;
}) {
  const ink = (alpha: number) => `rgba(${rgb},${alpha})`;
  const r = seal.r;
  const rim = r - 6;
  // Text along the top runs left to right over the crown; along the bottom it
  // runs the other way round the circle, which is what keeps it upright there
  // instead of hanging inverted under the middle.
  const arcTop = `M ${seal.cx - rim} ${seal.cy} A ${rim} ${rim} 0 0 1 ${seal.cx + rim} ${seal.cy}`;
  const arcBottom = `M ${seal.cx - rim} ${seal.cy} A ${rim} ${rim} 0 0 0 ${seal.cx + rim} ${seal.cy}`;
  const band = r * 0.22;

  return (
    <G transform={`rotate(${seal.tilt} ${seal.cx} ${seal.cy})`}>
      <Defs>
        <SvgPath id={`${id}-top`} d={arcTop} />
        <SvgPath id={`${id}-bottom`} d={arcBottom} />
      </Defs>

      {/* the rim, printed unevenly */}
      <SvgCircle
        cx={seal.cx} cy={seal.cy} r={r}
        stroke={ink(0.34)} strokeWidth={2.1} fill="none"
        strokeDasharray={`${r * 1.9} ${r * 0.06} ${r * 3.1} ${r * 0.1} ${r * 1.2} ${r * 0.05}`}
        strokeLinecap="round"
      />
      {/* where the stamp bore down hardest */}
      <SvgCircle
        cx={seal.cx} cy={seal.cy} r={r}
        stroke={ink(0.2)} strokeWidth={2.6} fill="none"
        strokeDasharray={`${r * 1.4} ${r * 4.9}`}
        strokeDashoffset={r * 0.8}
        strokeLinecap="round"
      />
      <SvgCircle
        cx={seal.cx} cy={seal.cy} r={r - 3}
        stroke={ink(0.26)} strokeWidth={0.7} fill="none"
        strokeDasharray={`${r * 2.6} ${r * 0.08} ${r * 3.4} ${r * 0.12}`}
      />

      {top ? (
        <SvgText
          fill={ink(0.42)}
          fontSize={r * 0.26}
          fontFamily={MONO}
          letterSpacing={r * 0.045}
          textAnchor="middle"
        >
          <TextPath href={`#${id}-top`} startOffset="50%">
            {top}
          </TextPath>
        </SvgText>
      ) : null}

      {bottom ? (
        <SvgText
          fill={ink(0.34)}
          fontSize={r * 0.15}
          fontFamily={MONO}
          letterSpacing={r * 0.02}
          textAnchor="middle"
        >
          <TextPath href={`#${id}-bottom`} startOffset="50%">
            {bottom}
          </TextPath>
        </SvgText>
      ) : null}

      {/* the band the date sits in, between two rules */}
      {date ? (
        <>
          <SvgRect
            x={seal.cx - (r - 7)} y={seal.cy - band}
            width={(r - 7) * 2} height={0.9} fill={ink(0.3)}
          />
          <SvgRect
            x={seal.cx - (r - 7)} y={seal.cy + band}
            width={(r - 7) * 2} height={0.9} fill={ink(0.3)}
          />
          <SvgText
            x={seal.cx} y={seal.cy + band * 0.62}
            fill={ink(0.44)}
            fontSize={r * 0.22}
            fontFamily={MONO}
            letterSpacing={r * 0.02}
            textAnchor="middle"
          >
            {date}
          </SvgText>
        </>
      ) : (
        // A control stamp carries an initial and nothing else.
        <SvgText
          x={seal.cx} y={seal.cy + r * 0.3}
          fill={ink(0.4)}
          fontSize={r * 0.8}
          fontFamily={MONO}
          textAnchor="middle"
        >
          T
        </SvgText>
      )}
    </G>
  );
}

/**
 * A document sitting in its sleeve, drawn as a miniature of the pass it opens
 * into — same accent card, same labelled fields, same code in a white well — so
 * tapping one reads as the card growing rather than a different screen.
 *
 * Behaves like the covers: drag it around (3D tilt, springs back), tap to open,
 * pull it far out of the object and release to toss it away (delete).
 */
export function PaperSheet({ document, accent, gradient, paper = '#f6efdf', variant = 'ticket', toss, tossDown = TOSS_DISTANCE, onView, onDelete }: PaperSheetProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);
  const pressed = useSharedValue(0);
  const [confirming, setConfirming] = React.useState(false);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Keyed on the document rather than on its place in the fan, so a card keeps
  // the colours it was stamped in when others are added or tossed out around it.
  const inks = sealInks(document.id);

  // The country the cover's map is centred on. The leaf inside a cover shows
  // the same world lit in the same place, or no map at all if none is set.
  const home = findCountry(useHomeCountry() ?? '');

  const handleView = () => {
    hapticImpact();
    onView(document);
  };

  /**
   * Asks in the app's own terms rather than the system's.
   *
   * One path for every platform now: the web branch called `window.confirm`
   * and the native one raised a system alert, so the one moment in the app
   * that destroys something was also the one moment that looked like nothing
   * else in it.
   */
  const confirmToss = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    setConfirming(true);
  };

  // vertical pulls lift the sheet (and toss it); horizontal swipes are left
  // to the fan's scroll view
  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-14, 14])
    .onStart(() => {
      lift.value = withSpring(1, PRESS_SPRING);
      runOnJS(hapticSelect)();
    })
    .onChange((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      if (toss) {
        // Normalised per direction, so 1 means armed whichever way it went and
        // the boundary can read one number for both of its edges.
        toss.value = e.translationY / (e.translationY < 0 ? TOSS_DISTANCE : tossDown);
      }
    })
    /**
     * Vertical distance alone, where this used to be the diagonal.
     *
     * The gesture is vertical by design — sideways belongs to the fan's own
     * scrolling — but the radial test meant a drag with any drift in it armed
     * before it had gone the distance the boundary is drawn at. A cue that
     * says "here" while the real line is somewhere nearer is worse than none.
     */
    .onEnd((e) => {
      if (e.translationY < -TOSS_DISTANCE || e.translationY > tossDown) {
        runOnJS(confirmToss)();
      }
    })
    .onFinalize(() => {
      lift.value = withSpring(0, SETTLE_SPRING);
      tx.value = withSpring(0, SETTLE_SPRING);
      ty.value = withSpring(0, SETTLE_SPRING);
      // Straight off rather than springing: the boundary is a statement about
      // where the hand is, and the hand has gone.
      if (toss) toss.value = withTiming(0, { duration: 160 });
    });

  const stops = gradient?.length ? gradient : [accent, accent];

  const tap = Gesture.Tap()
    .onBegin(() => {
      pressed.value = withSpring(1, PRESS_SPRING);
    })
    .onFinalize((_e, success) => {
      pressed.value = withSpring(0, SETTLE_SPRING);
      if (success) runOnJS(handleView)();
    });

  const gesture = Gesture.Race(pan, tap);

  const sheetStyle = useAnimatedStyle(() => {
    const tiltY = interpolate(tx.value, [-120, 120], [-11, 11], Extrapolation.CLAMP);
    const tiltX = interpolate(ty.value, [-120, 120], [9, -9], Extrapolation.CLAMP);
    /**
     * The card thins out the further it is carried toward being thrown away.
     *
     * It reads as the thing going, which is what is about to happen — and it
     * does the work the wash cannot: the fan's strip cuts a card off at its own
     * edge, and a card at a quarter opacity has no hard edge left to cut.
     */
    const travel = Math.abs(ty.value) / (ty.value < 0 ? TOSS_DISTANCE : tossDown);
    return {
      opacity: interpolate(travel, [0.2, 1.05], [1, 0.14], Extrapolation.CLAMP),
      transform: [
        { perspective: 900 },
        { translateX: tx.value },
        { translateY: ty.value },
        { rotateY: `${tiltY}deg` },
        { rotateX: `${tiltX}deg` },
        { scale: 1 + lift.value * 0.05 - pressed.value * 0.04 },
      ],
    };
  });

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View
          // Passport cards only. Drawing the card into one bitmap lets the tilt
          // filter that bitmap instead of re-rasterising the vector texture at
          // every angle, which is both smoother and cheaper — but only while the
          // card's content holds still. A ticket card is a BlurView, and a blur's
          // backdrop changes whenever anything behind it moves, so rasterising one
          // forces a fresh raster every frame and costs more than it saves.
          shouldRasterizeIOS={variant === 'passport'}
          style={[styles.shadowWrap, variant === 'passport' && styles.shadowWrapBook, sheetStyle]}
        >
          {variant === 'passport' ? (
            /* A carte d'identité: a printed blank with a photograph fixed to it,
               a revenue label stuck across the corner of that, and two office
               seals put down over the lot. The density comes from the printing —
               the frame, the captions, the ruled blanks, the printer's imprint —
               which is where it comes from on the real thing too. Only the name
               was ever written in.

               Print and hand are two colours: the form is one ink, the entry
               another, which is what separates what was printed from what
               somebody added. */
            <View style={[styles.sheet, styles.book]}>
              <LinearGradient
                colors={bookGradient(document.id)}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* One texture only. Every SVG pattern layer here is paid once per
                  card in the fan, and the fan sits behind the pass deck while it
                  opens — so a second one on each card shows up as lag on the tap,
                  not as a slower card. */}
              <Texture variant="paper" opacity={0.75} />

              {/* Every rule and box the form was printed with, in one canvas:
                  it stays a single native view however much is drawn into it. */}
              <Svg
                width={SHEET_WIDTH}
                height={SHEET_HEIGHT}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                {/* the frame the whole form is printed inside, doubled the way
                    these were — one hairline, one heavier, close together */}
                <SvgRect
                  x={PAGE.frame.x} y={PAGE.frame.y}
                  width={PAGE.frame.w} height={PAGE.frame.h} rx={PAGE.frame.r}
                  stroke="rgba(67,57,44,0.34)" strokeWidth={0.9} fill="none"
                />
                <SvgRect
                  x={PAGE.frame.x + 2.5} y={PAGE.frame.y + 2.5}
                  width={PAGE.frame.w - 5} height={PAGE.frame.h - 5} rx={PAGE.frame.r - 2.5}
                  stroke="rgba(67,57,44,0.16)" strokeWidth={0.4} fill="none"
                />

                {/* the rule under the heading, likewise doubled */}
                <SvgRect x={PAGE.m + 4} y={PAGE.head} width={SHEET_WIDTH - (PAGE.m + 4) * 2} height={0.8} fill={PAGE_PRINT} />
                <SvgRect x={PAGE.m + 4} y={PAGE.head + 2} width={SHEET_WIDTH - (PAGE.m + 4) * 2} height={0.35} fill={PAGE_RULE} />

                {/* the shadow the photograph casts on the card it is fixed to.
                    Drawn rather than cast: the picture clips its own corners, and
                    a view that clips cannot also throw a shadow. */}
                <SvgRect
                  x={PAGE.photo.x + 1.2} y={PAGE.photo.y + 1.8}
                  width={PAGE.photo.w} height={PAGE.photo.h}
                  fill="rgba(48,38,26,0.16)"
                />

                {/* the description, ruled and captioned and never filled in */}
                {PAGE.right.rows.map((y) => (
                  <SvgRect key={`r${y}`} x={PAGE.right.x} y={y} width={PAGE.right.w} height={0.6} fill={PAGE_RULE} />
                ))}

                {/* the crease, worn through to the paper along its ridge */}
                <SvgRect x={0} y={PAGE.fold} width={SHEET_WIDTH} height={0.8} fill="rgba(67,57,44,0.22)" />
                <SvgRect x={0} y={PAGE.fold + 0.8} width={SHEET_WIDTH} height={1.4} fill="rgba(255,255,255,0.32)" />

                {/* the hairline under the name, and nothing else down here */}
                <SvgRect x={PAGE.m} y={PAGE.name.rule} width={SHEET_WIDTH - PAGE.m * 2} height={0.7} fill={PAGE_RULE} />

                {/* the print, pressed straight onto the card */}
                <Defs>
                  <ClipPath id={`print-${document.id}`}>
                    <SvgRect x={PAGE.print.x} y={PAGE.print.y} width={PAGE.print.w} height={PAGE.print.h} />
                  </ClipPath>
                </Defs>
                {/* Clipped to its square, so the outer ridges run off the edges the
                    way a rolled print overruns the square it was taken in. */}
                <G clipPath={`url(#print-${document.id})`}>
                  {/* the ink that came off the whole pad of the finger, under the
                      ridges — a print is a smudge with a pattern in it */}
                  <SvgPath
                    d={`M ${PRINT.cx - 24} ${PRINT.cy + 22} C ${PRINT.cx - 30} ${PRINT.cy - 20} ${PRINT.cx + 30} ${PRINT.cy - 20} ${PRINT.cx + 26} ${PRINT.cy + 22} Z`}
                    fill="rgba(52,42,30,0.055)"
                  />
                  {PRINT.ridges.map((ridge, i) => (
                    <SvgPath
                      key={`f${i}`}
                      d={ridge.d}
                      stroke={`rgba(48,38,28,${ridge.alpha.toFixed(3)})`}
                      strokeWidth={0.62}
                      strokeLinecap="round"
                      strokeDasharray={ridge.dash}
                      fill="none"
                    />
                  ))}
                </G>

                {/* the photograph's own printed edge */}
                <SvgRect
                  x={PAGE.photo.x} y={PAGE.photo.y} width={PAGE.photo.w} height={PAGE.photo.h}
                  stroke="rgba(67,57,44,0.42)" strokeWidth={0.7} fill="none"
                />
              </Svg>

              {/* the photograph, the thing the card is really about */}
              <View
                style={[
                  styles.photo,
                  { left: PAGE.photo.x, top: PAGE.photo.y, width: PAGE.photo.w, height: PAGE.photo.h },
                ]}
              >
                {document.preview?.uri ? (
                  <>
                    <Image source={{ uri: document.preview.uri }} style={styles.windowImage} contentFit="cover" />
                    {/* The page's own shade laid back over the scan, so it reads
                        as fixed to this stock rather than pasted onto it. */}
                    <LinearGradient
                      colors={bookGradient(document.id)}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={[StyleSheet.absoluteFill, styles.windowTint]}
                      pointerEvents="none"
                    />
                    {/* A print of this age is darker at the edges than the middle;
                        without it the picture reads as a screenshot in a box. */}
                    <LinearGradient
                      colors={['rgba(38,30,20,0.20)', 'transparent', 'rgba(38,30,20,0.26)']}
                      locations={[0, 0.42, 1]}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  </>
                ) : (
                  <View style={styles.windowEmpty}>
                    <Ionicons name="person-outline" size={26} color="rgba(67,57,44,0.32)" />
                  </View>
                )}
              </View>

              {/* the head of the form */}
              <Text style={[styles.pageAuthority, { top: 4 }]}>TRAVELET</Text>
              <Text style={[styles.pageTitle, { top: 10 }]}>PASSPORT</Text>
              {/* The printer's own reference for the blank, not the holder's —
                  the number on a form like this belongs to the form. */}
              <Text style={[styles.pageNumber, { top: 5 }]}>Mod. B-14</Text>

              {/* the description: captions with nothing after them */}
              {PAGE_DESCRIPTION.map((caption, i) => (
                <Text key={caption} style={[styles.blockLabel, { top: PAGE.right.rows[i] - 6, left: PAGE.right.x }]}>
                  {caption}
                </Text>
              ))}

              {/* Below the fold the card stops being a form and becomes the
                  object: the name at weight, a hairline, the same halftone world
                  the cover carries, and the app's own foot. Nothing is captioned
                  that does not need to be. */}
              <Text style={[styles.nameCaption, { top: PAGE.name.caption }]}>Name of holder</Text>
              <Text
                style={[styles.nameValue, { top: PAGE.name.value }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >
                {document.traveler || document.name}
              </Text>

              {/* The cover's map again, cropped to a band and turned down to the
                  weight of print on paper. Same component, same country lit —
                  this is the leaf inside that cover, and it says so. */}
              <WorldDots
                style={[
                  styles.dotBand,
                  { left: PAGE.dots.x, top: PAGE.dots.y, width: PAGE.dots.w, height: PAGE.dots.h },
                ]}
                color="rgba(67,57,44,0.34)"
                radius={0.3}
                lit={home?.box}
                litColor="rgba(58,46,34,0.78)"
                litRadius={0.5}
                zoom={0.66}
                centerLon={home?.lon ?? 10}
              />

              {/* Set as the cover sets its own foot: the quiet line and the one
                  at weight, on the same margins. */}
              <Text style={[styles.footLine, { top: PAGE.foot }]}>travelet</Text>
              <Text style={[styles.footStrong, { top: PAGE.foot }]}>Personal travel wallet</Text>

              {/* Everything added to the card after it was filled in: the label
                  stuck on, the seals pressed down, the staples driven through.
                  Drawn last so it lands over the picture and over the entry, in
                  the order it happened — the line work under the photograph and
                  this over it are two canvases only because a view cannot be half
                  under and half over another. */}
              <Svg
                width={SHEET_WIDTH}
                height={SHEET_HEIGHT}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                {/* the revenue label, across the photograph's corner */}
                <G transform={`rotate(-6 ${PAGE.revenue.x + PAGE.revenue.w / 2} ${PAGE.revenue.y + PAGE.revenue.h / 2})`}>
                  <SvgRect
                    x={PAGE.revenue.x} y={PAGE.revenue.y}
                    width={PAGE.revenue.w} height={PAGE.revenue.h}
                    fill="rgba(214,126,142,0.52)" stroke={PAGE_REVENUE} strokeWidth={0.7}
                  />
                  {/* its own printed border, inside the perforations */}
                  <SvgRect
                    x={PAGE.revenue.x + 2.5} y={PAGE.revenue.y + 2.5}
                    width={PAGE.revenue.w - 5} height={PAGE.revenue.h - 5}
                    stroke={PAGE_REVENUE} strokeWidth={0.4} fill="none"
                  />
                  {/* the medallion, and the value under it */}
                  <SvgCircle
                    cx={PAGE.revenue.x + PAGE.revenue.w / 2}
                    cy={PAGE.revenue.y + 17}
                    r={9.5}
                    stroke={PAGE_REVENUE} strokeWidth={0.7} fill="rgba(214,126,142,0.32)"
                  />
                  <SvgCircle
                    cx={PAGE.revenue.x + PAGE.revenue.w / 2}
                    cy={PAGE.revenue.y + 17}
                    r={6}
                    stroke={PAGE_REVENUE} strokeWidth={0.4} fill="none"
                  />
                  {/* the lettering, at the size lettering on these actually is:
                      a texture rather than a word */}
                  {[0, 1, 2].map((i) => (
                    <SvgRect
                      key={`t${i}`}
                      x={PAGE.revenue.x + 8} y={PAGE.revenue.y + 32 + i * 3.4}
                      width={PAGE.revenue.w - 16} height={0.9}
                      fill="rgba(150,60,80,0.4)"
                    />
                  ))}
                  {/* perforations, bitten out of all four edges */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <React.Fragment key={`p${i}`}>
                      <SvgCircle cx={PAGE.revenue.x + 3 + i * 5.6} cy={PAGE.revenue.y} r={1.4} fill="rgba(0,0,0,0.09)" />
                      <SvgCircle cx={PAGE.revenue.x + 3 + i * 5.6} cy={PAGE.revenue.y + PAGE.revenue.h} r={1.4} fill="rgba(0,0,0,0.09)" />
                      <SvgCircle cx={PAGE.revenue.x} cy={PAGE.revenue.y + 4 + i * 7.6} r={1.4} fill="rgba(0,0,0,0.09)" />
                      <SvgCircle cx={PAGE.revenue.x + PAGE.revenue.w} cy={PAGE.revenue.y + 4 + i * 7.6} r={1.4} fill="rgba(0,0,0,0.09)" />
                    </React.Fragment>
                  ))}
                </G>

                {/* Office seals, over whatever they landed on: a dated one
                    across the picture, a control initial down on the form. */}
                <Seal
                  seal={PAGE.seals[0]}
                  id={`s0-${document.id}`}
                  ink={inks[0]}
                  top="TRAVELET"
                  bottom="CARNET DE VOYAGE"
                  date={formatDate(document.dateAdded).toUpperCase()}
                />
                <Seal seal={PAGE.seals[1]} id={`s1-${document.id}`} ink={inks[1]} />

                {/* the staples driven through opposite corners of the picture */}
                {[
                  { x: PAGE.photo.x + 4, y: PAGE.photo.y + 5, deg: -45 },
                  { x: PAGE.photo.x + PAGE.photo.w - 15, y: PAGE.photo.y + PAGE.photo.h - 7, deg: -45 },
                ].map((staple) => (
                  <G key={`${staple.x}-${staple.y}`} transform={`rotate(${staple.deg} ${staple.x + 6} ${staple.y})`}>
                    {/* the shadow it presses into the paper, then the wire */}
                    <SvgRect x={staple.x} y={staple.y + 1} width={12} height={2} rx={0.7} fill="rgba(30,24,14,0.28)" />
                    <SvgRect x={staple.x} y={staple.y - 1} width={12} height={2.2} rx={0.7} fill="rgba(84,86,92,0.9)" />
                    <SvgRect x={staple.x} y={staple.y - 1} width={12} height={0.8} rx={0.4} fill="rgba(255,255,255,0.5)" />
                  </G>
                ))}
              </Svg>

            </View>
          ) : (
          <BlurView intensity={72} tint="light" style={styles.sheet}>
            <View style={styles.frost} pointerEvents="none" />
            <GlassLayers
              gradient={stops}
              radius={16}
              baseAlpha={0.62}
              alphaRange={0.3}
              glow={0.55}
              noise={0.75}
            />

            <View style={styles.top}>
              {/* Ends on the tear, like the full pass */}
              <LinearGradient
                colors={['rgba(0,0,0,0.44)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.3)']}
                locations={[0, 0.6, 1]}
                style={[StyleSheet.absoluteFill, { bottom: -TEAR_NOTCH / 2 }]}
                pointerEvents="none"
              />
              <Text style={styles.name} numberOfLines={2}>
                {document.name}
              </Text>
              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>TRAVELER</Text>
                  <Text style={styles.value} numberOfLines={1}>
                    {document.traveler || '—'}
                  </Text>
                </View>
                <View style={styles.fieldNarrow}>
                  <Text style={styles.label}>ADDED</Text>
                  <Text style={styles.value} numberOfLines={1}>
                    {formatDate(document.dateAdded)}
                  </Text>
                </View>
              </View>
            </View>

            <Perforation notch={TEAR_NOTCH} cut={paper} slit={5} gap={5} />

            <View style={styles.well}>
              {document.barcode?.uri ? (
                <View style={styles.codePanel}>
                  <Image
                    source={{ uri: document.barcode.uri }}
                    style={styles.code}
                    contentFit="contain"
                    allowDownscaling={false}
                  />
                </View>
              ) : document.preview?.uri ? (
                /* Nothing to scan, so the well shows the document itself.
                   Held to the top of the page rather than centred: the head of
                   a sheet is where its letterhead, title and route are printed,
                   and that band is what tells one voucher from another at this
                   size. The middle of a page is usually terms and conditions. */
                <View style={styles.pagePanel}>
                  <Image
                    source={{ uri: document.preview.uri }}
                    style={styles.page}
                    contentFit="cover"
                    contentPosition="top"
                  />
                  {/* The crop softened into the stock, so the cut edge reads as
                      a page continuing rather than an image ending. */}
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.9)']}
                    locations={[0.62, 1]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                </View>
              ) : (
                <View style={styles.noCode}>
                  <Ionicons name="document-text-outline" size={15} color="#fff" />
                  <Text style={styles.noCodeText} numberOfLines={1}>
                    {document.fileSize}
                  </Text>
                </View>
              )}
            </View>

          </BlurView>
          )}
        </Animated.View>
      </GestureDetector>

      <TossConfirm
        visible={confirming}
        name={document.name}
        onKeep={() => setConfirming(false)}
        onThrow={() => {
          setConfirming(false);
          onDelete(document);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    width: SHEET_WIDTH,
    height: SHEET_HEIGHT,
    borderRadius: 18,
    ...SHADOW_SHEET,
  },
  sheet: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  frost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  top: {
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 10,
  },
  name: {
    fontFamily: 'PlusJakartaSans_700Bold',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
    lineHeight: 15,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  field: { flex: 1, minWidth: 0 },
  fieldNarrow: { flexShrink: 0 },
  label: {
    fontFamily: 'PlusJakartaSans_500Medium',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.65)',
  },
  value: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  perforation: {
    marginTop: 9,
    marginBottom: 2,
    justifyContent: 'center',
  },
  dashes: {
    marginHorizontal: 10,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  well: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 5,
  },
  // Square where it's bound, rounded where it opens.
  shadowWrapBook: {
    borderTopLeftRadius: BOOK_SPINE_RADIUS,
    borderBottomLeftRadius: BOOK_SPINE_RADIUS,
    borderTopRightRadius: BOOK_EDGE_RADIUS,
    borderBottomRightRadius: BOOK_EDGE_RADIUS,
  },
  // Bound on one edge, rounded on the other — shape rather than ornament.
  book: {
    borderTopLeftRadius: BOOK_SPINE_RADIUS,
    borderBottomLeftRadius: BOOK_SPINE_RADIUS,
    borderTopRightRadius: BOOK_EDGE_RADIUS,
    borderBottomRightRadius: BOOK_EDGE_RADIUS,
  },
  /** The issuing office, set small over the form's title. */
  pageAuthority: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontFamily: MONO,
    fontSize: 4.4,
    letterSpacing: 2.6,
    textAlign: 'center',
    color: 'rgba(67,57,44,0.5)',
  },
  pageTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontFamily: MONO,
    fontSize: 7.4,
    letterSpacing: 2.2,
    textAlign: 'center',
    color: PAGE_PRINT,
  },
  /** The file number, in the margin where a clerk would find it. */
  pageNumber: {
    position: 'absolute',
    right: PAGE.m,
    fontFamily: MONO,
    fontSize: 5,
    letterSpacing: 0.6,
    color: PAGE_REVENUE,
  },
  /** A caption on the description block, printed as small as it was set. */
  blockLabel: {
    position: 'absolute',
    fontFamily: MONO,
    fontSize: 4,
    letterSpacing: 0.3,
    color: 'rgba(67,57,44,0.5)',
  },
  /**
   * The bottom half, set the way the cover is.
   *
   * No mono, no tracking, no ornament: the cover's own idiom is small text at
   * two weights on a tight measure, and the leaf inside it now answers to that
   * instead of to the typewriter the top of the form was filled in on.
   */
  nameCaption: {
    position: 'absolute',
    left: PAGE.m,
    fontSize: 5.5,
    lineHeight: 7,
    letterSpacing: 0.1,
    color: 'rgba(67,57,44,0.5)',
  },
  nameValue: {
    position: 'absolute',
    left: PAGE.m,
    right: PAGE.m,
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#241d14',
  },
  /** The halftone band; the dots draw themselves, this only places them. */
  dotBand: {
    position: 'absolute',
  },
  footLine: {
    position: 'absolute',
    left: PAGE.m,
    fontSize: 5.5,
    lineHeight: 7,
    color: 'rgba(67,57,44,0.5)',
  },
  footStrong: {
    position: 'absolute',
    right: PAGE.m,
    fontSize: 5.5,
    lineHeight: 7,
    fontWeight: '700',
    color: 'rgba(67,57,44,0.62)',
  },
  /** The photograph's own well, under the staples that hold it on. */
  photo: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'rgba(67,57,44,0.08)',
  },
  /**
   * Set as the cover sets its own foot: a name at weight, a quiet line under
   * it, both flush left on the same margin. The tracked-out capitals belonged
   * to the burgundy cover and read as ornament beside the new one.
   */
  windowImage: { flex: 1 },
  /** Enough to unify the whites, not so much that the page stops being legible. */
  windowTint: { opacity: 0.22 },
  /** Seats the page in its window instead of letting it float in the opening. */
  windowEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 10,
  },
  codePanel: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 7,
  },
  code: {
    width: '100%',
    height: '100%',
  },
  /**
   * The page, in the footprint the code would have had.
   *
   * Same square as codePanel so a card keeps its shape whichever it carries —
   * a fan of documents where some are a stop taller than others reads as
   * broken. No padding, unlike the code: a code needs a quiet margin to be
   * read by a scanner, a page is meant to run to its own edge.
   */
  pagePanel: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(67,57,44,0.22)',
  },
  page: {
    width: '100%',
    height: '100%',
  },
  noCode: {
    alignItems: 'center',
    gap: 3,
  },
  noCodeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
  },
});
