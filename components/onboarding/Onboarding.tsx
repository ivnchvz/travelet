import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { searchCountries } from '../../services/Countries';
import { OnboardingProfile, setHomeCountry } from '../../services/OnboardingService';
import { CloudBackground } from '../CloudBackground';
import { BoardingPassCover, PassportCover } from '../physical/Covers';

const MONO = 'SpaceMono';
const PAGES = 7;
const TRACK_WIDTH = 240;
const TRACK_HEIGHT = 44;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A playful route: climbs, dips and climbs again on its way to the pin.
const CURVE = (() => {
  const N = 64;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    xs.push(t * TRACK_WIDTH);
    ys.push(
      TRACK_HEIGHT / 2 -
        Math.sin(t * Math.PI * 2) * TRACK_HEIGHT * 0.34 -
        Math.sin(t * Math.PI * 5) * TRACK_HEIGHT * 0.07
    );
  }
  // cumulative arc length → uniform plane speed along the curve
  const cum: number[] = [0];
  for (let i = 1; i < N; i++) {
    cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  }
  const length = cum[N - 1];
  const fracs = cum.map((c) => c / length);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return { N, xs, ys, fracs, length, d };
})();

interface OnboardingProps {
  visible: boolean;
  onDone: (profile: OnboardingProfile) => void;
}

/** As many as the step has room for without the list needing to scroll. */
const MAX_TRAVELERS = 6;

/** Gentle levitation for the page illustrations. */
function Float({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [v]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (v.value - 0.5) * 10 }],
  }));
  // entering lives on the outer view so it can't clobber the float transform
  return (
    <Animated.View entering={FadeInUp.springify().delay(delay)}>
      <Animated.View style={style}>{children}</Animated.View>
    </Animated.View>
  );
}

/** Static frosted sheet used in the illustrations. */
function MiniSheet({
  children,
  rotate = 0,
  dashed = false,
}: {
  children: React.ReactNode;
  rotate?: number;
  dashed?: boolean;
}) {
  return (
    <View
      style={[
        s.miniSheet,
        dashed && s.miniSheetDashed,
        { transform: [{ rotate: `${rotate}deg` }] },
      ]}
    >
      {!dashed && <View style={s.miniFold} />}
      {children}
    </View>
  );
}

/**
 * Flight-path progress: a little plane flies along a wavy route,
 * drawing a solid contrail behind it as the user moves through the steps.
 * The plane banks with the curve's tangent.
 */
function FlightProgress({ page }: { page: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(page / (PAGES - 1), { damping: 16, stiffness: 90 });
  }, [page, progress]);

  const trailProps = useAnimatedProps(() => ({
    strokeDashoffset: CURVE.length * (1 - progress.value),
  }));

  const planeStyle = useAnimatedStyle(() => {
    const { xs, ys, fracs, N } = CURVE;
    const p = Math.min(Math.max(progress.value, 0), 1);
    let i = 1;
    while (i < N - 1 && fracs[i] < p) i++;
    const f0 = fracs[i - 1];
    const f1 = fracs[i];
    const t = f1 > f0 ? (p - f0) / (f1 - f0) : 0;
    const x = xs[i - 1] + (xs[i] - xs[i - 1]) * t;
    const y = ys[i - 1] + (ys[i] - ys[i - 1]) * t;
    const angle = Math.atan2(ys[i] - ys[i - 1], xs[i] - xs[i - 1]);
    return {
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${angle}rad` }],
    };
  });

  return (
    <View style={s.track}>
      <Svg
        width={TRACK_WIDTH}
        height={TRACK_HEIGHT}
        viewBox={`0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`}
        style={StyleSheet.absoluteFill}
      >
        {/* the route still to fly */}
        <Path
          d={CURVE.d}
          stroke="rgba(15,23,42,0.25)"
          strokeWidth={1.6}
          strokeDasharray="4 6"
          strokeLinecap="round"
          fill="none"
        />
        {/* the contrail already drawn */}
        <AnimatedPath
          d={CURVE.d}
          stroke="#0f172a"
          strokeWidth={2.2}
          strokeDasharray={`${CURVE.length} ${CURVE.length}`}
          strokeLinecap="round"
          fill="none"
          animatedProps={trailProps}
        />
      </Svg>
      {/* origin + destination */}
      <View style={[s.trackDot, { left: -3, top: CURVE.ys[0] - 3 }]} />
      <Ionicons
        name="location"
        size={14}
        color="#0f172a"
        style={[s.trackPin, { top: CURVE.ys[CURVE.N - 1] - 16 }]}
      />
      {/* the plane rides the curve */}
      <Animated.View style={[s.plane, planeStyle]}>
        <Ionicons name="airplane" size={20} color="#0f172a" />
      </Animated.View>
    </View>
  );
}

export function Onboarding({ visible, onDone }: OnboardingProps) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [country, setCountry] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState('');
  const [travelers, setTravelers] = useState<string[]>([]);
  const [travelerDraft, setTravelerDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const countryResults = useMemo(() => searchCountries(countryQuery), [countryQuery]);

  const addTraveler = () => {
    const name = travelerDraft.trim();
    // Matched case-insensitively so "ana" doesn't land beside "Ana".
    const duplicate = travelers.some((t) => t.toLowerCase() === name.toLowerCase());
    if (!name || duplicate || travelers.length >= MAX_TRAVELERS) return;

    setTravelers((current) => [...current, name]);
    setTravelerDraft('');
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const removeTraveler = (name: string) => {
    setTravelers((current) => current.filter((t) => t !== name));
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) {
      setPage(next);
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    }
  };

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: width * index, animated: true });
    setPage(index);
  };

  const finish = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onDone({
      country: country ?? undefined,
      // A name half-typed when the button is hit is still a name they meant.
      travelers: [...travelers, travelerDraft.trim()].filter(Boolean),
    });
  };

  const pickCountry = (code: string) => {
    setCountry(code);
    // published before the profile is saved, so the passport on the welcome page
    // is already marked if the user swipes back to look
    setHomeCountry(code);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setTimeout(() => goTo(5), 450);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish}>
      <View style={s.root}>
        {/* the welcome tour always lands on a bright morning */}
        <CloudBackground phase="morning" weather="clear" />

        <TouchableOpacity style={s.skip} onPress={finish} hitSlop={10}>
          <Text style={s.skipText}>SKIP</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          >
            {/* 1 — welcome */}
            <View style={[s.page, { width }]}>
              <Float delay={80}>
                <View style={s.passportBox}>
                  <PassportCover name="Passport" count={0} />
                </View>
              </Float>
              <Animated.View entering={FadeInUp.springify().delay(180)} style={s.textBlock}>
                <Text style={s.kicker}>WELCOME ABOARD</Text>
                <Text style={s.title}>travelet</Text>
                <Text style={s.body}>
                  Your travel papers, kept as the real things — passports, boarding passes and
                  visas, all on one shelf.
                </Text>
              </Animated.View>
            </View>

            {/* 2 — open the objects */}
            <View style={[s.page, { width }]}>
              <Float delay={80}>
                <View style={s.passBox}>
                  <BoardingPassCover name="Boarding" count={3} />
                </View>
              </Float>
              <Animated.View entering={FadeInUp.springify().delay(180)} style={s.textBlock}>
                <Text style={s.kicker}>TAP TO OPEN</Text>
                <Text style={s.heading}>Everything opens</Text>
                <Text style={s.body}>
                  Tap a passport and it opens like a book. Swipe up and down to browse the shelf —
                  every object floats, tilts and springs like the real thing.
                </Text>
              </Animated.View>
            </View>

            {/* 3 — handle the papers */}
            <View style={[s.page, { width }]}>
              <Float delay={80}>
                <View style={s.sheetRow}>
                  <MiniSheet rotate={-6}>
                    <Ionicons name="document-text-outline" size={22} color="#2563eb" />
                    <Text style={s.miniSheetText}>VISA.PDF</Text>
                  </MiniSheet>
                  <MiniSheet rotate={4}>
                    <Ionicons name="hand-left-outline" size={22} color="#7c3aed" />
                    <Text style={s.miniSheetText}>DRAG ME</Text>
                  </MiniSheet>
                  <MiniSheet rotate={-3} dashed>
                    <Ionicons name="add" size={24} color="#16a34a" />
                    <Text style={[s.miniSheetText, { color: '#16a34a' }]}>BLANK{'\n'}SHEET</Text>
                  </MiniSheet>
                </View>
              </Float>
              <Animated.View entering={FadeInUp.springify().delay(180)} style={s.textBlock}>
                <Text style={s.kicker}>DRAG · TOSS · TUCK IN</Text>
                <Text style={s.heading}>Handle the paperwork</Text>
                <Text style={s.body}>
                  Inside, documents are sheets of paper. Drag them around, pull one far out to
                  toss it away, and slip new ones in with the blank sheet.
                </Text>
              </Animated.View>
            </View>

            {/* 4 — peek inside */}
            <View style={[s.page, { width }]}>
              <Float delay={80}>
                <View style={s.peekCard}>
                  <View style={s.peekHeader}>
                    <View style={s.peekIcon}>
                      <Ionicons name="document-text" size={14} color="#fff" />
                    </View>
                    <Text style={s.peekTitle}>flight-home.pdf</Text>
                  </View>
                  <View style={s.peekChips}>
                    <Text style={s.peekChip}>12 JUN 2026</Text>
                    <Text style={s.peekChip}>AA123</Text>
                    <Text style={s.peekChip}>14:30</Text>
                    <Text style={s.peekChip}>X4B9ZQ</Text>
                  </View>
                </View>
              </Float>
              <Animated.View entering={FadeInUp.springify().delay(180)} style={s.textBlock}>
                <Text style={s.kicker}>NOTHING LEAVES YOUR POCKET</Text>
                <Text style={s.heading}>Peek inside</Text>
                <Text style={s.body}>
                  Tap any sheet and travelet reads the PDF right on your phone — dates, flights
                  and booking references at a glance. No internet involved.
                </Text>
              </Animated.View>
            </View>

            {/* 5 — where the traveller is from */}
            <View style={[s.page, { width }]}>
              <Animated.View entering={FadeInUp.springify().delay(80)} style={s.textBlock}>
                <Text style={s.kicker}>SO YOUR PASSPORT KNOWS ITS OWNER</Text>
                <Text style={s.heading}>Where are you from?</Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.springify().delay(160)} style={s.countryBlock}>
                <View style={s.searchRow}>
                  <Ionicons name="search" size={16} color="#64748b" />
                  <TextInput
                    style={s.searchInput}
                    placeholder="Search countries"
                    placeholderTextColor="#94a3b8"
                    value={countryQuery}
                    onChangeText={setCountryQuery}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {countryQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCountryQuery('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  style={s.countryList}
                  contentContainerStyle={s.countryListContent}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {countryResults.map((option) => {
                    const active = country === option.code;
                    return (
                      <TouchableOpacity
                        key={option.code}
                        style={[s.countryRow, active && s.countryRowActive]}
                        onPress={() => pickCountry(option.code)}
                        activeOpacity={0.85}
                      >
                        <View style={[s.countryInk, { backgroundColor: option.ink }]} />
                        <Text
                          style={[s.countryName, active && { color: '#fff' }]}
                          numberOfLines={1}
                        >
                          {option.name}
                        </Text>
                        <Text
                          style={[
                            s.countryCode,
                            active && { color: 'rgba(255,255,255,0.75)' },
                          ]}
                        >
                          {option.code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {countryResults.length === 0 && (
                    <Text style={s.countryEmpty}>
                      Nothing matches “{countryQuery.trim()}” — skip ahead and set it later.
                    </Text>
                  )}
                </ScrollView>
              </Animated.View>
            </View>

            {/* 6 — who the papers belong to */}
            <View style={[s.page, { width }]}>
              <Animated.View entering={FadeInUp.springify().delay(80)} style={s.textBlock}>
                <Text style={s.kicker}>SO WE CAN SET UP YOUR SHELF</Text>
                <Text style={s.heading}>Who&apos;s travelling?</Text>
                <Text style={s.body}>
                  Every document gets filed under someone. Name them once and they&apos;re a tap
                  away from then on.
                </Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.springify().delay(160)} style={s.nameBlock}>
                {travelers.length > 0 && (
                  <View style={s.nameRow}>
                    {travelers.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={s.nameChip}
                        onPress={() => removeTraveler(name)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${name}`}
                      >
                        <Text style={s.nameChipText}>{name}</Text>
                        <Ionicons name="close" size={12} color="rgba(255,255,255,0.75)" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {travelers.length < MAX_TRAVELERS && (
                  <View style={s.nameInputRow}>
                    <Ionicons name="person-outline" size={16} color="#64748b" />
                    <TextInput
                      style={s.nameInput}
                      placeholder={travelers.length === 0 ? 'Your name' : 'Add another'}
                      placeholderTextColor="#94a3b8"
                      value={travelerDraft}
                      onChangeText={setTravelerDraft}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={addTraveler}
                    />
                    {!!travelerDraft.trim() && (
                      <TouchableOpacity onPress={addTraveler} hitSlop={8}>
                        <Ionicons name="add-circle" size={20} color="#0f172a" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Animated.View>

              <Animated.View entering={FadeInUp.springify().delay(320)}>
                <Text style={s.optionHint}>
                  {travelers.length === 0 ? 'OR SKIP — YOU CAN NAME THEM LATER' : 'TAP A NAME TO REMOVE IT'}
                </Text>
              </Animated.View>
            </View>

            {/* 7 — the promise, then take off */}
            <View style={[s.page, { width }]}>
              <Animated.View entering={FadeInUp.springify().delay(80)} style={s.textBlock}>
                <Text style={s.kicker}>LAST STAMP</Text>
                <Text style={s.heading}>Nothing leaves this phone</Text>
                <Text style={s.body}>
                  Your documents are read and kept on the device itself. No account, no upload,
                  no server — not even ours.
                </Text>
              </Animated.View>

              {/* The claim, itemised. It is the reason to hand an app a passport,
                  and it is worth more here than one more thing to fill in. */}
              <Animated.View entering={FadeInUp.springify().delay(180)} style={s.promiseBlock}>
                {[
                  { icon: 'cloud-offline-outline' as const, text: 'Works with no connection' },
                  { icon: 'person-circle-outline' as const, text: 'No sign-up, no account' },
                  { icon: 'lock-closed-outline' as const, text: 'Read on your device, stored on it' },
                ].map((line, i) => (
                  <Animated.View
                    key={line.text}
                    entering={FadeInUp.springify().delay(240 + i * 80)}
                    style={s.promiseRow}
                  >
                    <Ionicons name={line.icon} size={16} color="#0f172a" />
                    <Text style={s.promiseText}>{line.text}</Text>
                  </Animated.View>
                ))}
              </Animated.View>

              <TouchableOpacity style={s.cta} onPress={finish} activeOpacity={0.85}>
                <Ionicons name="airplane" size={16} color="#fff" />
                <Text style={s.ctaText}>Step inside</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* flight-path progress + next */}
          <View style={s.footer}>
            <FlightProgress page={page} />
            {page < PAGES - 1 ? (
              <TouchableOpacity
                style={s.next}
                onPress={() => goTo(page + 1)}
                activeOpacity={0.85}
                hitSlop={8}
              >
                <Ionicons name="arrow-forward" size={20} color="#0f172a" />
              </TouchableOpacity>
            ) : (
              <View style={s.nextSpacer} />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#e9f0ff',
  },
  skip: {
    position: 'absolute',
    top: 64,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 10,
    fontFamily: MONO,
    letterSpacing: 2,
    color: 'rgba(71,85,105,0.7)',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 36,
  },
  passportBox: {
    width: 168,
    aspectRatio: 0.72,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1e293b',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  passBox: {
    width: 300,
    aspectRatio: 2.1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1e293b',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniSheet: {
    width: 92,
    height: 116,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: -6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: 'hidden',
  },
  miniSheetDashed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    borderColor: 'rgba(22,163,74,0.6)',
  },
  miniFold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 14,
    borderLeftWidth: 14,
    borderTopColor: 'rgba(255,255,255,0.95)',
    borderLeftColor: 'transparent',
  },
  miniSheetText: {
    fontSize: 8,
    fontFamily: MONO,
    letterSpacing: 1.5,
    color: '#475569',
    textAlign: 'center',
  },
  peekCard: {
    width: 270,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    padding: 16,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8,
  },
  peekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  peekIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  peekChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  peekChip: {
    fontSize: 10,
    fontFamily: MONO,
    color: '#1e293b',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  textBlock: {
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    fontSize: 9,
    fontFamily: MONO,
    letterSpacing: 3,
    color: 'rgba(71,85,105,0.65)',
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#020403',
    fontFamily: 'BeVietnamPro-Black',
  },
  heading: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
  },
  /** The names, and the field that adds them. */
  nameBlock: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  nameChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  /** The three lines that back the claim on the last page. */
  promiseBlock: {
    width: '100%',
    gap: 10,
  },
  promiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promiseText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  optionHint: {
    fontSize: 8,
    fontFamily: MONO,
    letterSpacing: 2,
    color: 'rgba(71,85,105,0.5)',
  },
  countryBlock: {
    width: '100%',
    gap: 12,
    // the list is the one page tall enough to want the height back on a small
    // screen; without this the page's centring pushes it under the footer
    flexShrink: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  countryList: {
    maxHeight: 268,
  },
  countryListContent: {
    gap: 8,
    paddingVertical: 2,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  countryRowActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  countryInk: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  countryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  countryCode: {
    fontSize: 10,
    fontFamily: MONO,
    letterSpacing: 1.5,
    color: '#64748b',
  },
  countryEmpty: {
    fontSize: 12,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 18,
  },
  footer: {
    alignItems: 'center',
    gap: 18,
    paddingBottom: 52,
    paddingTop: 6,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
  },
  trackDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0f172a',
  },
  trackPin: {
    position: 'absolute',
    right: -9,
  },
  plane: {
    position: 'absolute',
    left: -10,
    top: -10,
  },
  next: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  nextSpacer: {
    height: 52,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
