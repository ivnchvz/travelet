import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { buildPass } from '../../services/PassFields';
import { PDFBarcode, PDFDocument } from '../../services/PDFService';
import { extractPdfInsights, PDFInsights } from '../../services/PDFTextService';
import { Perforation } from './Perforation';
import { GlassLayers } from './GlassLayers';
import { ObjectType } from './theme';

const KEEP_AWAKE_TAG = 'travelet-barcode';

export interface PassItem {
  document: PDFDocument;
  barcode: PDFBarcode;
  /** Category accent — each pass keeps the colour of the object it came from. */
  accent: string;
  /** Multi-stop tint for the glass. */
  gradient?: string[];
  paper: string;
  objectType: ObjectType;
}

interface BarcodeSheetProps {
  items: PassItem[];
  /** Which pass to open on. */
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onShowDetails?: (document: PDFDocument) => void;
  onRename?: (document: PDFDocument) => void;
}

/**
 * Every scannable document, lined up as a swipeable deck — the same way Wallet
 * lets you move between passes without backing out to a list first.
 *
 * Passes parse their PDF for fields before you reach them — the one in view and
 * two either side — because a pass with no parse yet has an empty field grid,
 * and filling that in while someone is looking at it is the one thing the deck
 * must not do.
 */
export function BarcodeSheet({
  items,
  initialIndex,
  visible,
  onClose,
  onShowDetails,
  onRename,
}: BarcodeSheetProps) {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<PassItem>>(null);

  // Kept mounted through the closing animation, then torn down. Without this
  // the deck would vanish on the frame `visible` goes false and there would be
  // nothing left to animate out.
  const [mounted, setMounted] = useState(visible);
  const open = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      open.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      return;
    }

    open.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) runOnJS(setMounted)(false);
    });
  }, [visible, open]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: open.value }));

  // Rises and settles rather than just appearing. The motion starts on the
  // frame of the tap, so the deck reads as already arriving while the rest of
  // it is still being built.
  const deckStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [
      { scale: 0.94 + open.value * 0.06 },
      { translateY: (1 - open.value) * 18 },
    ],
  }));

  useEffect(() => {
    if (visible) setActiveIndex(initialIndex);
  }, [visible, initialIndex]);

  // Holding a code up to a scanner counts as "doing nothing" to iOS, so the
  // screen would dim and sleep mid-scan.
  useEffect(() => {
    if (!visible) return;

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [visible]);

  const onScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setActiveIndex(Math.min(Math.max(next, 0), Math.max(items.length - 1, 0)));
    },
    [width, items.length]
  );

  if (!mounted || items.length === 0) return null;

  const safeIndex = Math.min(Math.max(activeIndex, 0), items.length - 1);
  const active = items[safeIndex];

  return (
    <Animated.View
      style={[styles.overlay, backdropStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Transparent, so the passes float over whatever was left open behind */}
      <BlurView intensity={22} tint="light" style={styles.backdrop}>
        <View style={[styles.wash, { backgroundColor: active.paper }]} pointerEvents="none" />

        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={20} color="#0f172a" />
        </TouchableOpacity>

        <Animated.View style={[styles.deck, deckStyle]}>
          <FlatList
            ref={listRef}
            data={items}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.document.id}
            initialScrollIndex={Math.min(initialIndex, items.length - 1)}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={onScrollEnd}
            // Each pass is a BlurView over a stack of glass layers, and the
            // default window would build ten of them before the deck is even on
            // screen. You can only ever look at one, and paging is far too slow
            // to outrun a neighbour being built.
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            // Wide enough that the cards being prefetched are actually mounted —
            // an unmounted card has no effect to run and so never parses.
            windowSize={5}
            renderItem={({ item, index }) => (
              <View style={{ width }}>
                <PassCard
                  item={item}
                  // Two either side, not one. The index only updates when a page
                  // settles, so at the moment you land the card beyond it hasn't
                  // begun — a wider runway is what keeps the next one ready.
                  isNear={Math.abs(index - safeIndex) <= 2}
                  maxWidth={width}
                  maxHeight={height}
                  onShowDetails={onShowDetails}
                  onRename={onRename}
                />
              </View>
            )}
          />
        </Animated.View>

        {items.length > 1 && (
          <View style={styles.pager} pointerEvents="none">
            <Text style={styles.pagerText}>
              {safeIndex + 1} of {items.length}
            </Text>
            {items.length <= 10 && (
              <View style={styles.dots}>
                {items.map((item, index) => (
                  <View
                    key={item.document.id}
                    style={[styles.dot, index === safeIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </BlurView>
    </Animated.View>
  );
}

function PassCard({
  item,
  isNear,
  maxWidth,
  maxHeight,
  onShowDetails,
  onRename,
}: {
  item: PassItem;
  isNear: boolean;
  maxWidth: number;
  maxHeight: number;
  onShowDetails?: (document: PDFDocument) => void;
  onRename?: (document: PDFDocument) => void;
}) {
  const [insights, setInsights] = useState<PDFInsights | null>(null);
  const { document, barcode, accent, gradient, objectType } = item;

  // Parsing a PDF is not cheap, so the passes near you do it ahead of time and
  // not until the deck has finished opening — the parse is synchronous JS over
  // the whole file, so starting it on mount put it in the middle of the open.
  //
  // Whether the card is the *visible* one is deliberately not part of this. It
  // was, and the effect then tore down and restarted the moment a neighbour
  // became the visible card — throwing away the prefetch at the exact moment it
  // was needed, so every pass parsed from scratch under the user's eyes anyway.
  // The service queues and caches, so asking once when the card comes near is
  // enough; asking again costs nothing.
  useEffect(() => {
    if (!isNear || insights) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      extractPdfInsights(document.filePath)
        .then((result) => {
          if (!cancelled) setInsights(result);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [isNear, insights, document.filePath]);

  const pass = buildPass(objectType, document, insights);
  const stops = gradient?.length ? gradient : [accent, accent];

  const cardWidth = Math.min(maxWidth - 48, 380);
  // The notches show whatever is behind the card, which is the page wash.
  const cut = item.paper;
  const codeSide = Math.min(cardWidth - 72, maxHeight * 0.26);

  return (
    <View style={styles.page}>
      <View style={{ width: cardWidth }}>
        {/* One continuous card. The tear bites into its edges rather than
            splitting it in two — a full-width gap reads as two cards. */}
        <View style={styles.card}>
          <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
          <GlassLayers gradient={stops} radius={26} noise={0.6} glow={0.5} />

          <View style={styles.panelBody}>
            {/* Covers the whole upper body and stops on the tear, so the change
                in tone lands on the cut and reads as the two halves of a
                ticket rather than an arbitrary fade. */}
            <LinearGradient
              colors={[
                'rgba(0,0,0,0.42)',
                'rgba(0,0,0,0.34)',
                'rgba(0,0,0,0.3)',
                'rgba(0,0,0,0.32)',
              ]}
              locations={[0, 0.4, 0.75, 1]}
              style={[StyleSheet.absoluteFill, { bottom: -TEAR_NOTCH / 2 }]}
              pointerEvents="none"
            />

            <TouchableOpacity
              onPress={onRename ? () => onRename(document) : undefined}
              disabled={!onRename}
              activeOpacity={0.7}
            >
              <Text style={styles.kicker}>{pass.headerLabel}</Text>
              <View style={styles.kickerRow}>
                <Text style={styles.kickerValue} numberOfLines={1}>
                  {pass.headerValue}
                </Text>
                {onRename && <Ionicons name="pencil" size={12} color="rgba(255,255,255,0.6)" />}
              </View>
            </TouchableOpacity>

            {/* Keyed on whether the parse has landed, so the swap from the file
                name to a real route or flight number crossfades instead of
                changing under you. */}
            {pass.route ? (
              <Animated.View key="route" entering={FadeIn.duration(240)}>
                <View style={styles.routeRow}>
                  <View style={styles.routeEnd}>
                    <Text style={styles.routeCode}>{pass.route.from}</Text>
                    {!!pass.route.fromSub && (
                      <Text style={styles.routeSub} numberOfLines={1}>
                        {pass.route.fromSub}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="airplane" size={20} color="rgba(255,255,255,0.85)" />
                  <View style={[styles.routeEnd, styles.routeEndRight]}>
                    <Text style={styles.routeCode}>{pass.route.to}</Text>
                    {!!pass.route.toSub && (
                      <Text style={styles.routeSub} numberOfLines={1}>
                        {pass.route.toSub}
                      </Text>
                    )}
                  </View>
                </View>
                {/* The day of travel, under the journey it belongs to. The grid
                    holds six fields and a boarding pass has more than six worth
                    printing, so the date is better here than fighting seat and
                    gate for a cell. */}
                {!!pass.heroSub && (
                  <Text style={styles.routeDate} numberOfLines={1}>
                    {pass.heroSub}
                  </Text>
                )}
              </Animated.View>
            ) : (
              <View style={styles.heroBlock}>
                <Text style={styles.heroValue} numberOfLines={2}>
                  {pass.heroValue ?? document.name}
                </Text>
                {!!pass.heroSub && <Text style={styles.routeSub}>{pass.heroSub}</Text>}
              </View>
            )}

            <View style={styles.rule} />

            <View style={styles.grid}>
              {pass.grid.map((f) => (
                // Fades rather than snaps. Every field here comes out of the
                // parse, so before it lands the grid is empty and afterwards
                // it is full — the jump is the whole block at once.
                <Animated.View
                  key={f.label}
                  entering={FadeIn.duration(240)}
                  style={styles.gridCell}
                >
                  <Text style={styles.gridLabel}>{f.label}</Text>
                  <Text style={styles.gridValue} numberOfLines={1}>
                    {f.value}
                  </Text>
                </Animated.View>
              ))}
            </View>
          </View>

          <Perforation notch={TEAR_NOTCH} cut={cut} />

          <View style={styles.stub}>
            {/* The reference prints its barcode onto the glass. A QR needs
                dark-on-light to scan, so it keeps a white panel. */}
            <View style={styles.codePanel}>
              <Image
                source={{ uri: barcode.uri }}
                style={{ width: codeSide, height: codeSide }}
                contentFit="contain"
                allowDownscaling={false}
              />
            </View>
            {!!barcode.payload && (
              <Text style={styles.payload} numberOfLines={1} selectable>
                {barcode.payload}
              </Text>
            )}
          </View>
        </View>
      </View>

      {onShowDetails && (
        <TouchableOpacity
          style={styles.details}
          onPress={() => onShowDetails(document)}
          activeOpacity={0.75}
        >
          <Ionicons name="information-circle-outline" size={15} color="#334155" />
          <Text style={styles.detailsText}>Full document</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const TEAR_NOTCH = 22;

const styles = StyleSheet.create({
  /** Covers everything, including the safe areas, the way a modal used to. */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  deck: { flex: 1 },
  backdrop: { flex: 1 },
  wash: { ...StyleSheet.absoluteFillObject, opacity: 0.1 },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
  },
  close: {
    position: 'absolute',
    top: 60,
    right: 22,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pager: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  pagerText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: 'rgba(15,23,42,0.55)',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  dotActive: { backgroundColor: 'rgba(15,23,42,0.65)' },

  card: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  panelBody: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  kicker: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  kickerValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  routeRow: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeEnd: { flex: 1 },
  routeDate: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.72)',
  },
  routeEndRight: { alignItems: 'flex-end' },
  routeCode: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 46,
    color: '#ffffff',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  routeSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  heroBlock: { marginTop: 26 },
  heroValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    color: '#ffffff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  rule: {
    marginTop: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  grid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 18,
  },
  gridCell: { width: '33.33%', paddingRight: 8 },
  gridLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  gridValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    marginTop: 3,
    fontSize: 15,
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  stub: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  codePanel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
  },
  payload: {
    marginTop: 12,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Courier',
  },

  details: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  detailsText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#334155',
  },
});
