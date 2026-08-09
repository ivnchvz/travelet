import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const MONO = 'SpaceMono';

/** Rows the form is ruled into. Each takes an equal share of the height. */
const ROWS = 34;
/** Sprocket holes down each margin. */
const HOLES = 13;
/** Slits making up the tear line between margin and body. */
const SLITS = 34;

const RULE = '*'.repeat(35);

/** Five-row block letters, four columns each, for the banner. */
const BLOCK: Record<string, string[]> = {
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  L: ['#...', '#...', '#...', '#...', '####'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
};

function banner(word: string): string[] {
  return [0, 1, 2, 3, 4].map((row) =>
    word
      .split('')
      .map((ch) => (BLOCK[ch] ? BLOCK[ch][row] : '....'))
      .join('.')
      .replace(/\./g, ' ')
  );
}

/**
 * The lines printed on the closed form.
 *
 * The declared items are deliberately not among them. A cover that printed the
 * list would defeat the point of having a cover at all — the whole reason this
 * object opens is that what you are declaring is nobody's business until you
 * choose to show it.
 */
export function declarationListing(count: number): string[] {
  return [
    'TRAVELET CUSTOMS FORM        REV 1',
    RULE,
    RULE,
    ...banner('DECLARE'),
    RULE,
    '*****  CUSTOMS DECLARATION   *****',
    RULE,
    '',
    'Port of entry .......... --',
    'Date ................... --',
    '',
    `Items listed ........... ${String(count).padStart(2, '0')}`,
    'Status ................. SEALED',
    '',
    'Contents are not printed on this',
    'copy. Open the form to read or',
    'amend the list.',
    '',
    '>> TAP TO OPEN',
    '',
    RULE,
    'END OF FORM',
  ];
}

function Sprocket({ tearOn }: { tearOn: 'left' | 'right' }) {
  return (
    <View style={s.sprocket}>
      {Array.from({ length: HOLES }).map((_, i) => (
        <View key={i} style={s.holeCell}>
          <View style={s.hole} />
        </View>
      ))}
      <View style={[s.tear, tearOn === 'left' ? s.tearLeft : s.tearRight]}>
        {Array.from({ length: SLITS }).map((_, i) => (
          <View key={i} style={s.slit} />
        ))}
      </View>
    </View>
  );
}

/**
 * Continuous stationery: greenbar paper off a tractor-feed printer.
 *
 * Three columns — punched margin, ruled body, punched margin — with the tear
 * line between each margin and the body. The bar is what carries the look: rows
 * alternate a pale green wash with the bare stock, which is how fanfold paper
 * was ruled so the eye could hold a line across a wide sheet.
 *
 * The rows take an equal share of the height rather than a set leading, so the
 * form fills whatever it is given and the banding always ends flush at the
 * bottom edge instead of on a half-row.
 *
 * Like the ticket perforation, the tear line is a run of separate slits rather
 * than a dashed border: a border draws one stroke with even gaps and reads as a
 * drawn line, where the real thing is a column of little cuts.
 */
export function ContinuousForm({ lines }: { lines: string[] }) {
  const rows = useMemo(() => {
    const out = lines.slice(0, ROWS);
    while (out.length < ROWS) out.push('');
    return out;
  }, [lines]);

  return (
    <View style={s.form}>
      <Sprocket tearOn="right" />
      <View style={s.body}>
        {rows.map((line, i) => (
          <View key={i} style={[s.row, i % 2 === 1 && s.bar]}>
            <Text style={s.num}>{String(i + 1).padStart(2, ' ')}</Text>
            <Text style={s.line} numberOfLines={1}>
              {line}
            </Text>
          </View>
        ))}
      </View>
      <Sprocket tearOn="left" />
    </View>
  );
}

const s = StyleSheet.create({
  form: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    backgroundColor: '#fbfcf6',
  },
  sprocket: {
    width: 22,
    backgroundColor: '#fbfcf6',
    paddingVertical: 5,
  },
  holeCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hole: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#15170f',
  },
  tear: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  tearLeft: { left: 0 },
  tearRight: { right: 0 },
  slit: {
    width: 1,
    height: 3,
    backgroundColor: 'rgba(32,48,28,0.3)',
  },
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bar: {
    backgroundColor: '#dcead2',
  },
  num: {
    fontFamily: MONO,
    fontSize: 5,
    lineHeight: 8,
    color: 'rgba(40,62,38,0.5)',
    width: 12,
    textAlign: 'right',
    marginRight: 5,
  },
  line: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 7,
    lineHeight: 9,
    color: '#22301c',
  },
});
