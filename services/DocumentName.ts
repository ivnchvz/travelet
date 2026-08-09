import { detectRoute } from '@/services/PassFields';
import { ALL_CAPTIONS, extractPdfInsights, forgetPdfInsights, PdfLine } from '@/services/PDFTextService';

export interface NameSuggestion {
  /** The name to put in the field. */
  name: string;
  /** True when it was read off the document rather than off the file name. */
  fromDocument: boolean;
}

/**
 * Names a document the way its owner would.
 *
 * Files arrive called "lvtckt-28332756-59C542D280E877B0", because the site that
 * issued them named them for a database and not for a person, and a folder of
 * those is a folder you have to open one by one to use. The document itself
 * always knows what it is: it prints the journey across the top, or sets its
 * own title in the largest text on the page.
 *
 * Tried in order of how much it identifies the document. A journey is the most
 * useful thing a travel document can be called — "IB3456 · MAD → BCN" tells
 * you which of four boarding passes this is — so it goes first, and the
 * document's own title, which is usually only as specific as "Boarding pass",
 * comes after it.
 *
 * Falls back to the file name, tidied, and says so: a file that was already
 * given a sensible name by whoever sent it should keep it.
 */
export async function suggestDocumentName(
  filePath: string,
  fileName: string
): Promise<NameSuggestion> {
  const fallback = { name: fromFileName(fileName), fromDocument: false };

  let insights = null;
  try {
    insights = await extractPdfInsights(filePath);
  } catch {
    return fallback;
  }
  if (!insights || insights.empty) return fallback;

  const name = fromJourney(insights, fileName) ?? fromTitle(insights.lines);
  return name ? { name, fromDocument: true } : fallback;
}

/**
 * Drops a parse the modal is done with.
 *
 * The picked file sits in the import cache under a path nothing will ask about
 * again — the copy that gets kept has a different one — so its parse would
 * otherwise be held for the life of the process for no one.
 */
export function forgetSuggestion(filePath: string) {
  forgetPdfInsights(filePath);
}

/**
 * The journey, as the card would show it.
 *
 * Reuses the route detection the pass layout runs on, so a document that will
 * be shown as "MAD ✈ BCN" is called that too, and the flight number goes in
 * front because that is what distinguishes the outbound from the return.
 */
function fromJourney(
  insights: Parameters<typeof detectRoute>[0],
  fileName: string
): string | null {
  const route = detectRoute(insights, fileName);
  const flight = insights?.labels.flight ?? insights?.flights[0];

  if (route) return flight ? `${flight} · ${route.from} → ${route.to}` : `${route.from} → ${route.to}`;
  return flight ? `Flight ${flight}` : null;
}

/**
 * The document's own title.
 *
 * PDFTextService marks the lines set noticeably larger than the body, which is
 * where a document writes what it is — "Boarding Pass", "Confirmación de
 * reserva", the name of a hotel. The first one that reads like a title wins;
 * headings are also used for logos and for single stray words, so the shape
 * checks below do the discarding.
 */
function fromTitle(lines: PdfLine[]): string | null {
  for (const line of lines) {
    if (!line.heading) continue;

    const text = line.text.replace(/\s+/g, ' ').trim();
    if (!isTitleish(text)) continue;

    return shorten(text, 48);
  }
  return null;
}

/** Cut to length at the last whole word, so the tail is not half of one. */
function shorten(text: string, limit: number): string {
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Whether a heading can serve as a name.
 *
 * A title is words. What gets rejected here is everything else a large line
 * turns out to be: a reference number, a caption belonging to the field
 * underneath it, a single word, or a sentence of instructions.
 *
 * Leans towards accepting. The alternative to a title is the file name, which
 * on the documents this feature exists for is a checksum, so an imperfect
 * heading still beats what it replaces — and it lands in a field the person is
 * already looking at and can type over. Length is left to the caller to
 * shorten rather than being grounds for refusal here; only the finishing
 * punctuation of a real sentence rules a line out, since a title does not end
 * in a full stop and a line of instructions does.
 */
function isTitleish(text: string): boolean {
  if (text.length < 4 || text.length > 90) return false;
  // Needs to be mostly letters — a reference or a date is not a title.
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '').length;
  if (letters < text.length * 0.6) return false;

  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 12) return false;
  if (/[.!?]$/.test(text)) return false;

  // A caption names the field below it, not the document.
  return !ALL_CAPTIONS.includes(fold(text));
}

/**
 * The file name, once it has been tidied — or the fact that it is useless.
 *
 * Separators become spaces so "boarding_pass_MAD_BCN" reads as words. What
 * cannot be rescued is a name that was generated rather than written, and the
 * tell is a long unbroken run of hex or digits; those are handed back empty so
 * the caller knows it has nothing, rather than filling the field with a
 * checksum.
 */
function fromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const words = stem.replace(/[_+]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!words) return '';
  // "59C542D280E877B0", "28332756", a uuid — issued names, not written ones.
  if (/[0-9a-f]{8,}/i.test(words.replace(/-/g, ''))) return '';
  // Mostly digits is the same story with fewer characters.
  const digits = words.replace(/\D/g, '').length;
  if (digits > words.length * 0.4) return '';

  return words;
}

const FOLDED: Record<string, string> = {
  Á: 'A', À: 'A', Â: 'A', Ä: 'A', Ã: 'A', Å: 'A',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I',
  Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O', Õ: 'O',
  Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U',
  Ñ: 'N', Ç: 'C',
};

/** Upper-case and strip accents, the same fold PDFTextService matches on. */
function fold(value: string): string {
  let out = '';
  for (const ch of value) {
    const upper = ch === 'ß' ? 'S' : ch.toUpperCase();
    const single = upper.length === 1 ? upper : ch;
    out += FOLDED[single] ?? single;
  }
  return out;
}
