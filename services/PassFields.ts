import { ObjectType } from '@/components/physical/theme';
import { PDFDocument } from '@/services/PDFService';
import { PDFInsights } from '@/services/PDFTextService';

export interface PassField {
  label: string;
  value: string;
}

/** The big "LON ✈ BER" line, when the document turns out to be a journey. */
export interface PassRoute {
  from: string;
  to: string;
  fromSub?: string;
  toSub?: string;
}

export interface PassLayout {
  /** Small label/value pinned above the hero, e.g. "Ticket number / BA988". */
  headerLabel: string;
  headerValue: string;
  /** Either a route, or a single large value when there's no journey. */
  route?: PassRoute;
  heroValue?: string;
  heroSub?: string;
  /** Up to six labelled values, laid out three across. */
  grid: PassField[];
}

const first = (values?: string[]): string | undefined => values?.[0];

/** A time of day out of a labelled value like "MAD 08:30" or "08:30 h". */
const timeIn = (value?: string): string | undefined =>
  value?.match(/\b([01]?\d|2[0-3]):[0-5]\d(?:\s?[AP]M)?\b/i)?.[0].toUpperCase();
const second = (values?: string[]): string | undefined => values?.[1];

const field = (label: string, value?: string): PassField | undefined =>
  value ? { label, value } : undefined;

const pack = (candidates: (PassField | undefined)[], limit: number): PassField[] =>
  candidates.filter((f): f is PassField => !!f && !!f.value).slice(0, limit);

/**
 * Airport-style codes: "LIS-MAD", "LIS to MAD", "MAD a BCN", "LIS → MAD".
 *
 * Deliberately conservative — three-letter uppercase pairs are common enough in
 * PDF noise that a loose pattern would put nonsense in the largest text on the
 * card. Nothing found simply means no hero route, which the layout handles.
 *
 * Plenty of passes draw the journey rather than writing it — Volaris sets
 * "CUU ·——· TIJ" with a rule between the two — so a run of dots, dashes or
 * simply a column of space counts as a joiner. Two characters minimum: a single
 * space would make a route out of any two three-letter words in a row.
 *
 * The joining words are per language, but the blocklist below stays short on
 * purpose: half the obvious Spanish stopwords are real airports — LOS is Lagos,
 * DEL is Delhi, SIN is Singapore, LAS is Las Vegas, VER is Veracruz — so
 * excluding words to catch false routes would throw away true ones.
 */
const ROUTE_PATTERN = new RegExp(
  '\\b([A-Z]{3})' +
    '(?:' +
    // a word joining them, in any of the languages a pass is printed in
    '\\s*(?:-|–|—|→|>|\\/|\\bTO\\b|\\bA\\b|\\bAD\\b|\\bPARA\\b|\\bVERS\\b|\\bNACH\\b)\\s*' +
    '|' +
    // or drawn: a rule, dots, or simply a column of space between the two
    '[\\s·•∙.\\-–—_]{2,}' +
    ')' +
    '([A-Z]{3})\\b'
);

const NOT_ROUTES = new Set(['PDF', 'THE', 'AND', 'FOR', 'USD', 'EUR', 'GBP', 'MXN', 'ALL']);

const CITY = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .-]{2,22}$/;

/**
 * The journey, read off the page rather than out of the flattened text.
 *
 * A pass sets the two airports as their own row — "CUU        TIJ" — with the
 * cities beneath them. That layout survives in the reconstructed lines and is
 * lost in the flat text, where the run of spaces between the codes collapses
 * to one and the pair stops looking like a route at all.
 *
 * Where the row below holds exactly two words, they are the cities, in the same
 * order. Matching them by count rather than by distance avoids having to guess
 * what a page unit is worth on a document we have never seen.
 */
export function detectRoute(
  insights: PDFInsights | null,
  /** Somewhere else the journey might be written — a file name, usually. */
  alsoSearch = ''
): PassRoute | undefined {
  const lines = insights?.lines ?? [];

  for (let i = 0; i < lines.length; i++) {
    const codes = lines[i].cells.filter((cell) => /^[A-Z]{3}$/.test(cell.text));
    if (codes.length !== 2) continue;

    const [from, to] = codes;
    if (from.text === to.text || NOT_ROUTES.has(from.text) || NOT_ROUTES.has(to.text)) continue;

    const below = lines[i + 1]?.cells ?? [];
    const cities = below.length === 2 && below.every((cell) => CITY.test(cell.text)) ? below : null;

    return {
      from: from.text,
      to: to.text,
      fromSub: cities?.[0].text,
      toSub: cities?.[1].text,
    };
  }

  // Older path, for documents whose journey is only ever written inline —
  // "LIS-MAD" in a file name, say.
  const haystack = `${alsoSearch.toUpperCase()} ${(insights?.text ?? '').toUpperCase()}`;
  const match = haystack.match(ROUTE_PATTERN);
  if (!match) return undefined;

  const [, from, to] = match;
  if (from === to || NOT_ROUTES.has(from) || NOT_ROUTES.has(to)) return undefined;
  return { from, to };
}

export function buildPass(
  objectType: ObjectType,
  document: PDFDocument,
  insights: PDFInsights | null
): PassLayout {
  const dates = insights?.dates ?? [];
  const times = insights?.times ?? [];
  const flights = insights?.flights ?? [];
  const references = insights?.references ?? [];
  const amounts = insights?.amounts ?? [];
  const traveler = document.traveler?.trim();
  /**
   * Both the journey and the captioned fields are read only for flight
   * tickets. A visa, a policy and a folder of receipts are not journeys, and
   * the captions a pass prints mean nothing on them — so the other objects are
   * built exactly as they were.
   */
  const isFlight = objectType === 'boardingPass';
  const route = isFlight ? detectRoute(insights, document.name) : undefined;
  const said = isFlight ? insights?.labels ?? {} : {};

  switch (objectType) {
    case 'boardingPass': {
      // A caption the document printed beats a guess from shape: a ticket with
      // two times on it has a departure and an arrival, and only the captions
      // say which is which.
      const flight = said.flight ?? first(flights);
      const departs = timeIn(said.departure) ?? first(times);
      const arrives = timeIn(said.arrival) ?? second(times);
      return {
        headerLabel: flight ? 'Flight' : 'Boarding pass',
        headerValue: flight ?? document.name,
        route,
        // With a journey on the card the date belongs under it; without one the
        // passenger is the largest thing there is to show.
        heroValue: route ? undefined : said.passenger ?? traveler ?? document.name,
        heroSub: route ? said.date ?? first(dates) : 'Passenger',
        /**
         * Ordered by what you need standing at the gate.
         *
         * There are more fields than the six the grid holds, and the tail was
         * being cut — seat and gate are the two you actually look for, and they
         * were the two that fell off the end.
         */
        grid: pack(
          [
            field('Seat', said.seat),
            field('Gate', said.gate),
            field('Boards', timeIn(said.boarding)),
            field('Departs', departs),
            field('Arrives', arrives),
            field('Booking', said.booking ?? first(references)),
            field('Terminal', said.terminal),
            field('Passenger', said.passenger ?? traveler),
          ],
          6
        ),
      };
    }

    case 'visa':
      return {
        headerLabel: 'Visa',
        headerValue: first(references) ?? document.name,
        heroValue: traveler ?? document.name,
        heroSub: 'Holder',
        grid: pack(
          [
            field('Valid from', first(dates)),
            field('Expires', second(dates)),
            field('Reference', first(references)),
          ],
          6
        ),
      };

    case 'insurance':
      return {
        headerLabel: 'Policy',
        headerValue: first(references) ?? document.name,
        heroValue: traveler ?? document.name,
        heroSub: 'Insured',
        grid: pack(
          [
            field('Cover', first(amounts)),
            field('Valid from', first(dates)),
            field('Until', second(dates)),
          ],
          6
        ),
      };

    case 'passport':
      return {
        headerLabel: 'Identity',
        headerValue: first(references) ?? document.name,
        heroValue: traveler ?? document.name,
        heroSub: 'Holder',
        grid: pack(
          [field('Expires', first(dates)), field('Number', first(references))],
          6
        ),
      };

    default:
      return {
        headerLabel: 'Document',
        headerValue: first(references) ?? document.name,
        route,
        heroValue: route ? undefined : traveler ?? document.name,
        heroSub: route ? undefined : 'Name',
        grid: pack(
          [
            field('Date', first(dates)),
            field('Time', first(times)),
            field('Amount', first(amounts)),
            field('Reference', first(references)),
          ],
          6
        ),
      };
  }
}
