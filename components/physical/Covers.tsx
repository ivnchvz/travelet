import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect as SvgRect } from 'react-native-svg';
import { findCountry } from '../../services/Countries';
import { useHomeCountry } from '../../services/OnboardingService';
import { Caduceus } from './Caduceus';
import { coverArtFor, drawsOwnContent } from './coverArt';
import { OBJECT_SPECS } from './theme';
import { Texture } from './Texture';
import { WorldDots } from './WorldDots';

/** Drawn artwork standing in for the layers a cover would otherwise paint. */
function CoverPlate({ art }: { art: NonNullable<ReturnType<typeof coverArtFor>> }) {
  return <Image source={art.source} style={StyleSheet.absoluteFill} contentFit="cover" />;
}

/** Slow pulsing wrapper used for holographic elements. */
function Shimmer({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [v]);
  const animated = useAnimatedStyle(() => ({
    opacity: 0.5 + v.value * 0.4,
    transform: [{ rotate: `${v.value * 20 - 10}deg` }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export interface CoverProps {
  name: string;
  count: number;
}

const MONO = 'SpaceMono';
const HAIRLINE = 'rgba(60,60,67,0.12)'; // iOS separator
const SECONDARY = '#8e8e93'; // iOS systemGray
const LABEL = '#aeaeb2';

function documentsText(count: number) {
  return `${count} ${count === 1 ? 'document' : 'documents'}`;
}

// ---------------------------------------------------------------- Passport

/**
 * The passport, in the Swiss manner: uncoated grey stock, white type, and
 * nothing else that is not information.
 *
 * The whole cover is two flush-left blocks on one margin — the stacked title at
 * the head, the fine print at the foot — with the world between them. No rules,
 * no ornament, no gold: the restraint *is* the design, and a single decorative
 * mark would break it.
 *
 * The map is a window onto the world rather than the whole of it, running edge
 * to edge and centred on the traveller's own country. Fitting the whole world
 * in made it a small stripe; zooming gives the dots the size to read as a
 * texture you look *into*, which is the point of lighting one country inside
 * it. That country is drawn in full white at a larger radius, so it reads as
 * lit rather than merely tinted.
 *
 * Nothing here names an authority. The title is the country's own word for a
 * passport and the foot names this app — a cover carrying a real state's
 * emblem and issuing department would be a picture of a document rather than a
 * picture of a keepsake, which is the same line the souvenir stamps hold.
 */
export function PassportCover({ name }: CoverProps) {
  const art = coverArtFor('passport');
  const home = useHomeCountry();
  const country = home ? findCountry(home) : undefined;
  const titles = country?.titles ?? ['Passport', 'Travel document'];

  if (art) {
    return (
      <View style={pp.cover}>
        <CoverPlate art={art} />
      </View>
    );
  }

  return (
    <View style={pp.cover}>
      {/* Barely a gradient — enough to keep the stock from reading as flat fill,
          not enough to become lighting. */}
      <LinearGradient
        colors={['#94948f', '#8a8a85', '#7e7e7a']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* The speckle of uncoated board: light and dark flecks, both. */}
      <Texture variant="noise" opacity={0.75} />

      <WorldDots
        style={pp.map}
        color="rgba(255,255,255,0.34)"
        radius={0.34}
        lit={country?.box}
        litColor="#ffffff"
        litRadius={0.54}
        zoom={0.66}
        centerLon={country?.lon ?? 10}
      />

      <View style={pp.titles}>
        {titles.map((line) => (
          // the long ones — Паспорт Российской Федерации, Österreichischer
          // Reisepass — overrun the measure at full size; shrinking beats the
          // ellipsis, which would eat the word the cover exists to say
          <Text
            key={line}
            style={pp.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {line}
          </Text>
        ))}
      </View>

      <View style={pp.foot}>
        <View style={pp.footColumn}>
          <Text style={pp.footStrong} numberOfLines={1}>
            {country ? country.name : 'No country set'}
          </Text>
          {/* An unfilled field rather than an instruction: there is nowhere to
              be sent, and a blank on a form is what a real document does with
              something nobody wrote in. */}
          <Text style={pp.footLine} numberOfLines={1}>
            {country ? `${country.code} · ${country.entry}` : '— · —'}
          </Text>
        </View>
        <View style={pp.footColumn}>
          <Text style={pp.footLine}>travelet</Text>
          <Text style={pp.footStrong}>Personal travel wallet</Text>
        </View>
      </View>
    </View>
  );
}

const pp = StyleSheet.create({
  cover: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    position: 'absolute',
    // full bleed: the window itself does the enlarging, so the frame is the
    // cover and the world runs edge to edge
    left: 0,
    right: 0,
    top: '30%',
    bottom: '29%',
  },
  titles: {
    position: 'absolute',
    left: '12%',
    right: '8%',
    top: '11%',
  },
  title: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
    color: '#ffffff',
    letterSpacing: -0.1,
  },
  foot: {
    position: 'absolute',
    left: '12%',
    right: '8%',
    bottom: '8%',
    flexDirection: 'row',
    gap: 14,
  },
  footColumn: {
    flex: 1,
  },
  footLine: {
    fontSize: 6.5,
    lineHeight: 9,
    color: 'rgba(255,255,255,0.82)',
  },
  footStrong: {
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
});

// ----------------------------------------------------------- Boarding pass

const BARCODE = [3, 1, 2, 1, 4, 1, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 4, 1, 2, 3, 1, 1, 2];

export function BoardingPassCover({ name, count }: CoverProps) {
  const art = coverArtFor('boardingPass');

  return (
    <View style={bp.cover}>
      {art ? (
        <CoverPlate art={art} />
      ) : (
        <>
          <Texture variant="paper" opacity={0.45} />
          <Texture variant="halftone" opacity={0.2} />
        </>
      )}

      {drawsOwnContent(art) && (
      <>
        {/* header */}
        <View style={bp.header}>
          <View style={bp.logo}>
            <Ionicons name="airplane" size={11} color="#ffffff" />
          </View>
          <Text style={bp.airline}>Travelet Air</Text>
          <Text style={bp.passType}>{name}</Text>
        </View>
        <View style={bp.separator} />

        {/* route */}
        <View style={bp.routeRow}>
          <View>
            <Text style={bp.routeCode}>HME</Text>
            <Text style={bp.routeCity}>Home</Text>
          </View>
          <View style={bp.routeMiddle}>
            <Ionicons name="airplane" size={15} color={SECONDARY} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={bp.routeCode}>TRV</Text>
            <Text style={bp.routeCity}>Anywhere</Text>
          </View>
        </View>

        {/* fields */}
        <View style={bp.fieldsRow}>
          <View>
            <Text style={bp.fieldLabel}>PASSENGER</Text>
            <Text style={bp.fieldValue}>All travelers</Text>
          </View>
          <View>
            <Text style={bp.fieldLabel}>GATE</Text>
            <Text style={bp.fieldValue}>B7</Text>
          </View>
          <View>
            <Text style={bp.fieldLabel}>GROUP</Text>
            <Text style={bp.fieldValue}>2</Text>
          </View>
          <View>
            <Text style={bp.fieldLabel}>DOCS</Text>
            <Text style={bp.fieldValue}>{count}</Text>
          </View>
        </View>

        {/* barcode footer */}
        <View style={bp.dashedSeparator} />
        <View style={bp.barcodeRow}>
          <View style={bp.barcode}>
            {BARCODE.map((w, i) => (
              <View
                key={i}
                style={{ width: w, backgroundColor: '#1c1c1e', alignSelf: 'stretch', marginRight: 1.5 }}
              />
            ))}
          </View>
        </View>
      </>
      )}
    </View>
  );
}

const bp = StyleSheet.create({
  cover: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  logo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34c759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  airline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  passType: {
    marginLeft: 'auto',
    fontSize: 10,
    color: SECONDARY,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginTop: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeCode: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#1c1c1e',
  },
  routeCity: {
    fontSize: 9,
    color: SECONDARY,
    marginTop: 1,
  },
  routeMiddle: {
    flex: 1,
    alignItems: 'center',
  },
  fieldsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  fieldLabel: {
    fontSize: 8,
    letterSpacing: 0.6,
    color: LABEL,
    marginBottom: 2,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  dashedSeparator: {
    height: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    borderStyle: 'dashed',
  },
  barcodeRow: {
    alignItems: 'center',
  },
  barcode: {
    flexDirection: 'row',
    height: 26,
    alignItems: 'stretch',
  },
});

// ------------------------------------------------------------------- Visa

/** Ticks along the head of the sheet, as on a printer's registration edge. */
const REGISTRATION = Array.from({ length: 34 });
/** Run down the trailing margin, one letter to a line. */
const EDGE_MARK = 'TRAVELET'.split('');

/**
 * Field captions in several languages, the way a data page sets them: the
 * caption is small and repeated, the value below it is not. Setting one
 * language and leaving space for the rest is what makes a form look domestic;
 * a travel document is the opposite of domestic.
 */
const VISA_FIELDS = (name: string, count: number) => [
  { caption: 'Type · Type · Tipo', value: 'D' },
  { caption: 'Entries · Entrées · Ingressi', value: 'Multiple' },
  { caption: 'Category · Catégorie · Categoria', value: name },
  { caption: 'Docs · Docs · Docum.', value: String(count) },
];

export function VisaCover({ name, count }: CoverProps) {
  const art = coverArtFor('visa');

  return (
    <View style={vs.cover}>
      {art ? (
        <CoverPlate art={art} />
      ) : (
        <>
          {/* Security printing drifts through several hues rather than shading
              one. Four stops, all a breath off white, so the paper reads as
              tinted rather than coloured. */}
          <LinearGradient
            colors={['#f4fbff', '#eef4fd', '#fdf7ef', '#fdeff5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[vs.band, { top: '30%' }]} />
          <View style={[vs.band, { top: '58%' }]} />
          <Texture variant="linen" opacity={0.6} />
          {/* Lighter hand than the dark covers — dark cells on a near-white
              ground go from tone to grime very quickly. */}
          <Texture variant="halftone" opacity={0.2} />
        </>
      )}

      {drawsOwnContent(art) && (
        <>
          {/* Registration edge and margin mark sit under the type, outside its
              padding — they belong to the sheet, not to the layout on it. */}
          <View style={vs.registration} pointerEvents="none">
            {REGISTRATION.map((_, i) => (
              <View key={i} style={[vs.tick, i % 5 === 0 && vs.tickTall]} />
            ))}
          </View>
          <View style={vs.edgeMark} pointerEvents="none">
            {EDGE_MARK.map((ch, i) => (
              <Text key={i} style={vs.edgeMarkChar}>
                {ch}
              </Text>
            ))}
          </View>

          <View style={vs.content}>
            <View style={vs.headerRow}>
              <View style={vs.headerText}>
                <Text style={vs.country}>REPUBLIC OF TRAVELET</Text>
                <Text style={vs.visaWord}>VISA</Text>
                <Text style={vs.countryAlt}>Visa · Visum · Visto · Виза</Text>
              </View>
              <Shimmer>
                <LinearGradient
                  colors={['#fda4af', '#fde68a', '#86efac', '#93c5fd', '#c4b5fd']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={vs.hologram}
                />
              </Shimmer>
            </View>

            <View style={vs.headerRule} />

            <View style={vs.fieldsRow}>
              {VISA_FIELDS(name, count).map((field) => (
                <View key={field.caption} style={vs.fieldCol}>
                  <Text style={vs.fieldLabel} numberOfLines={1}>
                    {field.caption}
                  </Text>
                  <Text style={vs.fieldValue} numberOfLines={1}>
                    {field.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={vs.mrz}>
              <Text style={vs.mrzText} numberOfLines={1}>
                {mrzLine(`V<TVL${name}`)}
              </Text>
              <Text style={vs.mrzText} numberOfLines={1}>
                {mrzLine(`${count}DOCUMENTS<<TRAVELET`)}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

/** Machine-readable-zone line, padded with the classic chevron filler */
function mrzLine(text: string, length = 30) {
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '<');
  return (clean + '<'.repeat(length)).slice(0, length);
}

const vs = StyleSheet.create({
  cover: {
    flex: 1,
  },
  band: {
    position: 'absolute',
    left: -30,
    right: -30,
    height: 30,
    backgroundColor: 'rgba(59,130,246,0.04)',
    transform: [{ rotate: '-8deg' }],
  },
  registration: {
    position: 'absolute',
    top: 6,
    left: 14,
    right: 14,
    height: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tick: {
    width: StyleSheet.hairlineWidth,
    height: 2.5,
    backgroundColor: 'rgba(39,70,144,0.32)',
  },
  tickTall: {
    height: 5,
    backgroundColor: 'rgba(39,70,144,0.5)',
  },
  edgeMark: {
    position: 'absolute',
    right: 5,
    top: '34%',
    alignItems: 'center',
  },
  edgeMarkChar: {
    // set letter under letter rather than turned on its side: a rotated line of
    // text has to be given a width to rotate within, and it lies about its
    // bounds when the font metrics shift
    fontSize: 5,
    lineHeight: 6.5,
    fontFamily: MONO,
    color: 'rgba(39,70,144,0.3)',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 18,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flexShrink: 1,
  },
  country: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#6b8ec9',
    fontWeight: '600',
    marginBottom: 3,
  },
  visaWord: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 5,
    color: '#274690',
  },
  countryAlt: {
    fontSize: 6.5,
    letterSpacing: 0.4,
    color: '#8ea9d4',
    marginTop: 3,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(39,70,144,0.18)',
    marginTop: 10,
  },
  hologram: {
    width: 34,
    height: 34,
    borderRadius: 17,
    opacity: 0.65,
  },
  fieldsRow: {
    flexDirection: 'row',
    // the captions run long in three languages, so the columns share the
    // measure rather than each claiming a third of it
    gap: 10,
  },
  fieldCol: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 5.6,
    letterSpacing: 0.2,
    color: '#93aed6',
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#274690',
  },
  mrz: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    marginHorizontal: -16,
    marginBottom: -16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  mrzText: {
    fontSize: 10,
    fontFamily: MONO,
    // the zone is meant to be read by a machine, and prints darker than the
    // captions for it — it was the palest thing on the sheet
    color: '#5c6b85',
    letterSpacing: 0.5,
  },
});

// -------------------------------------------------------------- Insurance

/** Typewriter black, and the weight the rules are set at. */
const INK = '#1c1a17';
const RULE = 'rgba(28,26,23,0.55)';

/**
 * The insurance card as a letterpress tag: uncoated ivory, typewriter black,
 * ruled fields, and no colour anywhere.
 *
 * Everything is one monospace face at three sizes, hung on a single left margin
 * with an upright dividing the reference column from the fields. The form is
 * left blank on purpose — a tag is a thing waiting to be filled in, and setting
 * invented values in the same face the labels use would read as a printed
 * record rather than a blank.
 *
 * The kerykeion stands small on the right, whole rather than cropped, at an ink
 * between the rules and the labels — present on the card without competing with
 * the form it sits behind.
 *
 * Kept deliberately cheap to draw. The cover rotates on its hinge and
 * crossfades between faces every frame, so a live blur and several stacked
 * canvases on top of it stuttered. A cover is opaque by definition — there is
 * nothing behind it to see through — so the blur bought nothing and cost the
 * animation. Flat gradient, two grain passes, one vector layer.
 */

export function InsuranceCard(_props: CoverProps) {
  const art = coverArtFor('insurance');

  if (art) {
    return (
      <View style={ins.cover}>
        <CoverPlate art={art} />
        {drawsOwnContent(art) && <Text style={ins.artLabel}>MEDICAL INSURANCE</Text>}
      </View>
    );
  }

  return (
    <View style={ins.cover}>
      {/* Uncoated ivory, barely moving across the card. */}
      <LinearGradient
        colors={['#f4f0e5', '#eee9db', '#e7e1d2']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Texture variant="paper" opacity={0.6} />
      <Texture variant="noise" opacity={0.22} />

      {/* Under the form and cut by the card, at the weight of a blind stamp —
          it has to sit far enough back that the rules read over it. */}
      <Caduceus style={ins.watermark} color={INK} opacity={0.45} weight={1.4} />

      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 120 76" preserveAspectRatio="none">
        {/* Two rules across the whole measure, then the field rules inside the
            column — the same order the tag sets them in. */}
        <SvgRect x={6} y={32} width={108} height={0.35} fill={RULE} />
        <SvgRect x={6} y={42} width={108} height={0.35} fill={RULE} />
        <SvgRect x={26} y={52} width={88} height={0.35} fill={RULE} />
        <SvgRect x={26} y={62} width={88} height={0.35} fill={RULE} />

        {/* The upright that divides the reference column from the fields */}
        <SvgRect x={24} y={24} width={0.35} height={44} fill={RULE} />
      </Svg>

      <View style={ins.head}>
        <Text style={ins.headLine}>TRAVELET</Text>
        <Text style={ins.headLine}>MEDICAL COVER</Text>
        <Text style={ins.headLine}>POLICY RECORD</Text>
      </View>

      <Text style={ins.slashes}>Treatment / Assistance / Repatriation</Text>

      {/* the reference column, left of the upright */}
      <Text style={[ins.stub, { top: '36%' }]}>Date</Text>
      <Text style={[ins.stub, { top: '49%' }]}>Policy no.</Text>
      <Text style={[ins.stub, { top: '62%' }]}>Insurer</Text>

      {/* the fields, each hung on its own rule */}
      <Text style={[ins.field, { top: '36%' }]}>Name:</Text>
      <Text style={[ins.field, { top: '49%' }]}>Country of cover:</Text>
      <Text style={[ins.field, { top: '62%' }]}>Valid until:</Text>
      <Text style={[ins.field, { top: '75%' }]}>Emergency no.:</Text>

      {/* One row, not two absolute boxes. Both were pinned to the bottom on
          percentage margins while their type is set in points, so at the card's
          real width the label ran straight under the note. Laid out in flow they
          cannot overlap at any width; the minimum width keeps the note on the
          field column's margin while there is room for it. */}
      <View style={ins.foot}>
        <Text style={ins.label} numberOfLines={1}>
          MEDICAL INSURANCE
        </Text>
        <Text style={ins.note} numberOfLines={1}>
          Carry alongside your passport — present on admission
        </Text>
      </View>
    </View>
  );
}

const ins = StyleSheet.create({
  cover: {
    flex: 1,
    borderRadius: OBJECT_SPECS.insurance.radius,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: '7%',
    top: '6%',
    // Sized by width and ratio, never by a negative offset. Yoga drops a
    // negative percentage — `bottom: '-30%'`, meant to run the staff off the
    // card — and an absolute box with no resolvable height collapses to zero,
    // so the mark did not draw at all. The ratio is the drawing's own, so the
    // whole kerykeion lands inside the box with nothing cropped.
    width: '10%',
    aspectRatio: 44 / 258,
  },
  head: {
    position: 'absolute',
    left: '6%',
    top: '8%',
  },
  headLine: {
    fontFamily: MONO,
    fontSize: 7,
    lineHeight: 10,
    letterSpacing: 1.9,
    color: INK,
  },
  slashes: {
    position: 'absolute',
    left: '6%',
    /**
     * Clear of the upright.
     *
     * The rule that divides the reference column from the fields starts a
     * shade above where this line ended, so it came down through the middle of
     * a letter. Lifting the line settles it; dropping the upright instead would
     * have shortened the divider the whole form is hung on.
     */
    top: '26%',
    fontFamily: MONO,
    fontSize: 5.6,
    letterSpacing: 0.4,
    color: INK,
  },
  stub: {
    position: 'absolute',
    left: '6%',
    fontFamily: MONO,
    fontSize: 5,
    letterSpacing: 0.3,
    color: 'rgba(28,26,23,0.7)',
  },
  field: {
    position: 'absolute',
    left: '23%',
    fontFamily: MONO,
    fontSize: 5.6,
    letterSpacing: 0.3,
    color: INK,
  },
  foot: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    bottom: '6%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  /* Artwork covers have no row to sit in, so the label keeps its own corner. */
  artLabel: {
    position: 'absolute',
    left: '6%',
    bottom: '6%',
    fontFamily: MONO,
    fontSize: 5,
    letterSpacing: 1.2,
    color: 'rgba(28,26,23,0.6)',
  },
  label: {
    minWidth: '17%',
    flexShrink: 0,
    fontFamily: MONO,
    fontSize: 5,
    letterSpacing: 1.2,
    color: 'rgba(28,26,23,0.6)',
  },
  note: {
    flex: 1,
    fontFamily: MONO,
    fontStyle: 'italic',
    fontSize: 4.8,
    letterSpacing: 0.3,
    color: 'rgba(28,26,23,0.75)',
  },
});


// ----------------------------------------------------------------- Folder

interface FolderCoverProps extends CoverProps {
  /** Stock colour chosen when the folder was created. */
  tint?: string;
}

/**
 * Take a colour to dyed card stock: keep the hue, fix the saturation, and set
 * the lightness. Scaling the channels instead only walks a pale tint toward
 * grey — a folder has to be the same colour all the way through, which is what
 * makes it read as stock rather than as a surface someone painted.
 */
function deepen(hex: string, lightness: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return '#5c2029';
  const n = parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);

  let hue = 0;
  if (span !== 0) {
    if (max === r) hue = ((g - b) / span) % 6;
    else if (max === g) hue = (b - r) / span + 2;
    else hue = (r - g) / span + 4;
  }
  hue = (hue * 60 + 360) % 360;

  const saturation = 0.44;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const base = lightness - chroma / 2;
  const wheel: [number, number, number][] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ];
  const [rr, gg, bb] = wheel[Math.floor(hue / 60) % 6];
  const to = (v: number) => Math.round((v + base) * 255);
  return `rgb(${to(rr)}, ${to(gg)}, ${to(bb)})`;
}

/** Where the ruled lines of the contents list sit, in viewBox units. */
const FOLDER_RULES = Array.from({ length: 10 }, (_, i) => 52 + i * 6);

const RULE_INK = 'rgba(255,255,255,0.2)';

/**
 * The folder: dyed card stock, printed on itself.
 *
 * Everything is one colour. The rules, the boxes and the captions are the same
 * white laid on at a few percent, so they read as a lighter tone of the stock
 * rather than as ink of their own — which is how a printed folder actually
 * looks, and what keeps this on the same footing as the letterpress tag and the
 * grey passport instead of off in an illustration of its own.
 *
 * The face is a filing form: a flap across the head carrying the reference
 * block, then a contents list ruled down the left with two index panels beside
 * it. Only two of the lines are ever filled — the folder's name and how much is
 * in it. The rest are left blank, because a folder is a thing you write on.
 */
export function FolderCover({ name, count, tint = '#ecd5a7' }: FolderCoverProps) {
  const art = coverArtFor('folder');

  return (
    <View style={fd.wrap}>
      {art ? (
        <CoverPlate art={art} />
      ) : (
        <>
          <LinearGradient
            colors={[deepen(tint, 0.26), deepen(tint, 0.215)]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Texture variant="paper" opacity={0.5} />
          <Texture variant="noise" opacity={0.35} />

          {/* The viewBox is the cover's own ratio, so a unit here and a percent
              in the stylesheet land on the same place and the captions can be
              set against the rules without measuring anything. */}
          <Svg viewBox="0 0 100 119" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
            {/* the flap, a shade off the body, and the fold it turns on */}
            <SvgRect x={0} y={0} width={100} height={30} fill="rgba(255,255,255,0.035)" />
            <SvgRect x={0} y={29.7} width={100} height={0.5} fill="rgba(0,0,0,0.16)" />
            <SvgRect x={0} y={30.2} width={100} height={0.35} fill="rgba(255,255,255,0.14)" />
            {/* the two nicks punched at the fold */}
            <SvgRect x={45} y={30.2} width={1.6} height={1.4} rx={0.7} fill="rgba(0,0,0,0.18)" />
            <SvgRect x={53.4} y={30.2} width={1.6} height={1.4} rx={0.7} fill="rgba(0,0,0,0.18)" />

            {/* left panel of the flap, left blank */}
            <SvgRect
              x={7} y={7} width={38} height={16} rx={0.6}
              fill="none" stroke={RULE_INK} strokeWidth={0.4}
            />
            {/* reference block: three ruled rows */}
            {[0, 1, 2].map((row) => (
              <SvgRect
                key={row}
                x={51} y={7 + row * 5.4} width={42} height={5.4} rx={0.6}
                fill="none" stroke={RULE_INK} strokeWidth={0.4}
              />
            ))}

            {/* the contents list */}
            {FOLDER_RULES.map((y) => (
              <SvgRect key={y} x={7} y={y} width={49} height={0.35} fill={RULE_INK} />
            ))}

            {/* two index panels beside it */}
            <SvgRect
              x={61} y={49} width={15} height={57} rx={0.6}
              fill="none" stroke={RULE_INK} strokeWidth={0.4}
            />
            <SvgRect
              x={79} y={49} width={15} height={57} rx={0.6}
              fill="none" stroke={RULE_INK} strokeWidth={0.4}
            />
          </Svg>
        </>
      )}

      {drawsOwnContent(art) && (
        <>
          <View style={[fd.row, { top: '6.4%' }]}>
            <Text style={fd.caption}>OWNER</Text>
          </View>
          <View style={[fd.row, { top: '10.9%' }]}>
            <Text style={fd.caption}>FOLDER</Text>
            <Text style={fd.value} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <View style={[fd.row, { top: '15.4%' }]}>
            <Text style={fd.caption}>DETAILS</Text>
            <Text style={fd.value} numberOfLines={1}>
              {documentsText(count)}
            </Text>
          </View>
          <Text style={fd.contents}>CONTENTS</Text>
        </>
      )}
    </View>
  );
}

const fd = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
  },
  row: {
    position: 'absolute',
    // matches the reference block drawn at x 51..93 of 100
    left: '53%',
    right: '9%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caption: {
    fontFamily: MONO,
    fontSize: 5.4,
    letterSpacing: 0.7,
    color: 'rgba(255,255,255,0.45)',
  },
  value: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 5.4,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'right',
  },
  contents: {
    position: 'absolute',
    left: '7%',
    top: '38%',
    fontFamily: MONO,
    fontSize: 5.4,
    letterSpacing: 0.7,
    color: 'rgba(255,255,255,0.45)',
  },
});



// ----------------------------------------------------------- Declare form

export function DeclareCover({ count }: { count: number }) {
  return (
    <View style={dc.cover}>
      <Texture variant="paper" opacity={0.5} />
      <Text style={dc.title}>Customs{'\n'}Declaration</Text>
      <View style={dc.rule} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={dc.lineRow}>
          <View style={dc.checkbox}>
            {i < count && <Ionicons name="checkmark" size={10} color="#48484a" />}
          </View>
          <View style={dc.line} />
        </View>
      ))}
      <Text style={dc.itemCount}>
        {count} {count === 1 ? 'item' : 'items'} listed
      </Text>
      <View style={dc.stamp}>
        <Text style={dc.stampText}>DECLARE</Text>
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  cover: {
    flex: 1,
    backgroundColor: '#fdfcf8',
    padding: 20,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#1c1c1e',
    lineHeight: 27,
    marginTop: 6,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.3)',
    marginVertical: 14,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.25)',
    height: 12,
  },
  itemCount: {
    fontSize: 10,
    color: SECONDARY,
    marginTop: 'auto',
  },
  stamp: {
    position: 'absolute',
    right: 16,
    bottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,59,48,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-12deg' }],
  },
  stampText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: 'rgba(255,59,48,0.55)',
  },
});
