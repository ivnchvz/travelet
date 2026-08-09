import { toByteArray } from 'base64-js';
import * as FileSystem from 'expo-file-system';
import { inflate } from 'pako';
import { Platform } from 'react-native';

/** One reconstructed line of the document, positioned as it sits on the page. */
export interface PdfLine {
  /** Text of the line, with leading/interior spaces preserved for alignment. */
  text: string;
  /** True when this line is set noticeably larger than the body (a heading). */
  heading: boolean;
  /**
   * The line split at its wide gaps, each piece with the page position it was
   * drawn at.
   *
   * Captions and their values live in columns, and the column has to be
   * followed from one row to the next. Position in the rebuilt string cannot do
   * that — every line measures its own character width, so the same place on
   * the page lands at a different offset on each row, and a caption matched the
   * value from a neighbouring column.
   */
  cells: { x: number; text: string }[];
}

/** The fields a pass can name, whatever language it names them in. */
export type PassLabelKey =
  | 'flight'
  | 'booking'
  | 'departure'
  | 'arrival'
  | 'passenger'
  | 'seat'
  | 'gate'
  | 'terminal'
  | 'boarding'
  | 'date';

export type PassLabels = Partial<Record<PassLabelKey, string>>;

export interface PDFInsights {
  /** Best-effort plain text pulled out of the PDF (flattened, for searching). */
  text: string;
  /** Layout-aware reconstruction: lines in reading order with spacing preserved. */
  lines: PdfLine[];
  /** True when we could not decode anything readable */
  empty: boolean;
  dates: string[];
  times: string[];
  flights: string[];
  references: string[];
  amounts: string[];
  /** Values found sitting next to a caption the document itself printed. */
  labels: PassLabels;
}

/**
 * Fully offline, best-effort PDF text extraction *with layout*.
 *
 * PDFs store page text inside content streams (usually FlateDecode/zlib
 * compressed) as PostScript-like operators. We inflate every stream with pako
 * and interpret the text/positioning operators, tracking the text matrix and
 * CTM so every showed string carries an (x, y) page position and a size. From
 * those positioned runs we rebuild the page the way it reads: grouping runs
 * into lines by their y-coordinate, ordering them top-to-bottom, spacing them
 * horizontally by their x-coordinate, and marking larger runs as headings.
 *
 * No network, no native code — works on any PDF whose fonts use a standard
 * (non-subsetted CID) encoding; for the rest we report "nothing readable".
 */
export async function extractPdfInsights(filePath: string): Promise<PDFInsights> {
  if (Platform.OS === 'web' || filePath.startsWith('web://')) {
    return emptyInsights();
  }
  return enqueue(filePath, true);
}

/**
 * Parses documents ahead of being asked for them, at the back of the queue.
 *
 * Called once the app has settled, so the whole library is already read by the
 * time anyone opens a pass. These jobs always yield to a real request: a tap
 * that arrived while the warm-up was still grinding through the library would
 * otherwise queue behind all of it and feel slower than no warm-up at all.
 */
export function warmPdfInsights(filePaths: string[]) {
  if (Platform.OS === 'web') return;
  for (const filePath of filePaths) {
    if (filePath.startsWith('web://')) continue;
    // Nothing waits on these, so the rejection has to be absorbed here.
    enqueue(filePath, false).catch(() => {});
  }
}

/**
 * Parsed documents, kept for the life of the process.
 *
 * Everything below this point is synchronous JS over the whole file — inflating
 * every stream and then walking the content character by character — so a parse
 * costs real time on the JS thread and no two can truly overlap. One at a time,
 * urgent first, is therefore the most a queue here can do.
 *
 * A document's text doesn't change unless the file does, and a rename keeps the
 * same path, so caching on the path is safe.
 */
const insightsCache = new Map<string, PDFInsights>();

interface Job {
  promise: Promise<PDFInsights>;
  resolve: (value: PDFInsights) => void;
  reject: (error: unknown) => void;
  /** Someone is looking at this one now; it goes before any warm-up. */
  urgent: boolean;
}

const jobs = new Map<string, Job>();
let pumping = false;

function enqueue(filePath: string, urgent: boolean): Promise<PDFInsights> {
  const done = insightsCache.get(filePath);
  if (done) return Promise.resolve(done);

  const existing = jobs.get(filePath);
  if (existing) {
    // A warm-up already waiting for this file gets promoted rather than
    // duplicated, so opening a pass mid-warm-up jumps that file to the front.
    if (urgent) existing.urgent = true;
    return existing.promise;
  }

  let resolve!: (value: PDFInsights) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<PDFInsights>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  jobs.set(filePath, { promise, resolve, reject, urgent });
  void pump();
  return promise;
}

async function pump() {
  if (pumping) return;
  pumping = true;

  try {
    for (;;) {
      const next = takeNext();
      if (!next) break;

      const [filePath, job] = next;
      try {
        const result = await parsePdfInsights(filePath);
        insightsCache.set(filePath, result);
        job.resolve(result);
      } catch (error) {
        job.reject(error);
      } finally {
        jobs.delete(filePath);
      }

      // Let the interface breathe between background files. A parse holds the
      // thread for its whole duration, so back-to-back warm-up jobs would make
      // the app stutter for as long as the library takes to read.
      if (!job.urgent) await pause(60);
    }
  } finally {
    pumping = false;
  }
}

/** The oldest urgent job, or the oldest job of any kind if none are urgent. */
function takeNext(): [string, Job] | undefined {
  let first: [string, Job] | undefined;
  for (const entry of jobs) {
    if (entry[1].urgent) return entry;
    if (!first) first = entry;
  }
  return first;
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Drops a document's parse, for when the file behind a path actually changes. */
export function forgetPdfInsights(filePath: string) {
  insightsCache.delete(filePath);
  jobs.delete(filePath);
}

async function parsePdfInsights(filePath: string): Promise<PDFInsights> {
  const b64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = toByteArray(b64);
  const raw = latin1(bytes);

  const fonts = buildFonts(raw, bytes);

  const lines: PdfLine[] = [];
  let cursor = 0;
  while (true) {
    const streamAt = raw.indexOf('stream', cursor);
    if (streamAt === -1) break;
    const endAt = raw.indexOf('endstream', streamAt);
    if (endAt === -1) break;
    cursor = endAt + 9;

    /**
     * The stream's own dictionary is everything between its object header and
     * the stream keyword.
     *
     * It used to be found with lastIndexOf('<<'), which lands on whichever
     * angle brackets happen to come last — a nested sub-dictionary, or the
     * object before. A content stream whose neighbour mentioned an image was
     * then thrown out as an image itself, which is how a pass full of text
     * came back with none of it.
     */
    const objAt = raw.lastIndexOf(' obj', streamAt);
    const dictStart = objAt === -1 ? raw.lastIndexOf('<<', streamAt) : objAt;
    const dict = dictStart === -1 ? '' : raw.slice(dictStart, streamAt);
    // Skip streams that declare themselves as something other than content.
    if (
      /\/Subtype\s*\/(Image|XML|Type1C|CIDFontType0C|TrueType|OpenType)/.test(dict) ||
      /\/(Metadata|FontFile\d?|ICCBased)/.test(dict)
    ) {
      continue;
    }

    // Stream data starts after the EOL following "stream" and excludes the
    // EOL before "endstream" (pako rejects those trailing bytes)
    let dataStart = streamAt + 6;
    if (raw[dataStart] === '\r') dataStart++;
    if (raw[dataStart] === '\n') dataStart++;
    let dataEnd = endAt;
    while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)) {
      dataEnd--;
    }
    const data = bytes.subarray(dataStart, dataEnd);

    let content: string;
    if (/\/FlateDecode/.test(dict)) {
      try {
        content = latin1(inflate(data));
      } catch {
        continue;
      }
    } else if (!/\/Filter/.test(dict)) {
      content = latin1(data);
    } else {
      continue; // unsupported filter (DCT, LZW, …)
    }

    // Only interpret streams that actually draw text.
    if (!/\bBT\b|\bTj\b|\bTJ\b/.test(content)) continue;


    const runs = runsFromContentStream(content, fonts);
    const streamLines = linesFromRuns(runs);
    if (streamLines.length === 0) continue;

    // Separate content streams (≈ pages) with a blank line.
    if (lines.length > 0) lines.push({ text: '', heading: false, cells: [] });
    for (const l of streamLines) {
      lines.push(l);
      if (lines.length >= MAX_LINES) break;
    }
    if (lines.length >= MAX_LINES) break;
  }

  const text = normalize(lines.map((l) => l.text).join('\n'));


  if (!text || text.replace(/[^a-zA-Z0-9]/g, '').length < 4) {
    return emptyInsights();
  }
  return { text, lines, empty: false, ...mineFields(text), labels: mineLabels(lines) };
}

const MAX_LINES = 600;

function emptyInsights(): PDFInsights {
  return {
    text: '',
    lines: [],
    empty: true,
    dates: [],
    times: [],
    flights: [],
    references: [],
    amounts: [],
    labels: {},
  };
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content-stream interpreter → positioned text runs
// ---------------------------------------------------------------------------

/** A single showed string, placed on the page in device space. */
interface Run {
  x: number;
  y: number;
  size: number;
  text: string;
}

/** 2×3 affine matrix [a, b, c, d, e, f]. */
type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Compose: apply A first, then B (returns A×B in PDF row-vector convention). */
function mul(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/** Interpret a content stream, returning every showed string with its position. */
function runsFromContentStream(content: string, fonts: Map<string, PdfFont>): Run[] {
  const runs: Run[] = [];

  let ctm: Matrix = IDENTITY;
  const ctmStack: Matrix[] = [];
  let tm: Matrix = IDENTITY; // text matrix
  let lm: Matrix = IDENTITY; // text line matrix
  let leading = 0;
  let fontSize = 0;

  // Operand stack. Strings are held undecoded: what they say depends on the
  // font in force when they are shown, which Tf sets.
  type Operand =
    | { n: number }
    | { str: string; hex: boolean }
    | { a: string }
    | { name: string }
    | { skip: true };
  const stack: Operand[] = [];

  let font: PdfFont | undefined;

  /**
   * Glyph codes to text, through the font's own table.
   *
   * Without this, a subset font's codes are unprintable bytes and the run was
   * thrown away — which is why a pass set in embedded fonts came back with no
   * text at all, however well the patterns downstream were written.
   */
  const decode = (value: string, hex: boolean): string => {
    if (!hex) {
      const literal = decodePdfString(value);
      if (!font?.cmap || font.twoByte) return literal;
      let out = '';
      for (const ch of literal) out += font.cmap.get(ch.charCodeAt(0)) ?? ch;
      return out;
    }

    const clean = value.replace(/\s/g, '');
    if (!font?.cmap) return decodeHexString(clean);

    const width = font.twoByte ? 4 : 2;
    let out = '';
    for (let k = 0; k + width <= clean.length; k += width) {
      const code = parseInt(clean.slice(k, k + width), 16);
      out += font.cmap.get(code) ?? '';
    }
    return out;
  };

  const nums = (count: number): number[] => {
    const out: number[] = [];
    for (let i = stack.length - count; i < stack.length; i++) {
      const op = stack[i];
      out.push(op && 'n' in op ? op.n : 0);
    }
    return out;
  };

  const show = (str: string) => {
    if (!str) return;
    const trm = mul(tm, ctm);
    const x = trm[4];
    const y = trm[5];
    const scaleY = Math.hypot(trm[2], trm[3]) || 1;
    const size = (fontSize || 10) * scaleY;
    const clean = sanitizeRun(str);
    /**
     * A run of nothing but spaces is still a run.
     *
     * These were thrown away for being blank, which threw away the document's
     * own word breaks — the pass draws a space glyph between words like any
     * other character. Everything downstream was then left to guess where words
     * ended from the geometry, and guessed wrong in both directions at once.
     */
    if (clean.length > 0) {
      runs.push({ x, y, size, text: clean });
    }
    // Advance the text matrix by an estimated width so consecutive runs on the
    // same line don't stack on top of each other.
    const advance = str.length * (fontSize || 10) * 0.5;
    tm = mul([1, 0, 0, 1, advance, 0], tm);
  };

  const nextLine = () => {
    lm = mul([1, 0, 0, 1, 0, -leading], lm);
    tm = lm;
  };

  const n = content.length;
  let i = 0;
  while (i < n) {
    const ch = content[i];

    // Whitespace
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f' || ch === '\0') {
      i++;
      continue;
    }

    // Literal string "(...)"
    if (ch === '(') {
      const { raw, end } = readLiteral(content, i);
      stack.push({ str: raw, hex: false });
      i = end;
      continue;
    }

    // Hex string "<...>" or dictionary "<<...>>"
    if (ch === '<') {
      if (content[i + 1] === '<') {
        i = skipDict(content, i);
        continue;
      }
      const gt = content.indexOf('>', i);
      const inner = gt === -1 ? '' : content.slice(i + 1, gt);
      stack.push({ str: inner, hex: true });
      i = gt === -1 ? n : gt + 1;
      continue;
    }

    // Array "[...]" (TJ operand)
    if (ch === '[') {
      const { raw, end } = readArray(content, i);
      stack.push({ a: raw });
      i = end;
      continue;
    }

    // Name "/Xxx" — kept, because Tf names the font
    if (ch === '/') {
      const from = ++i;
      while (i < n && !isDelimiter(content[i])) i++;
      stack.push({ name: content.slice(from, i) });
      continue;
    }

    // Number
    if ((ch >= '0' && ch <= '9') || ch === '-' || ch === '+' || ch === '.') {
      let j = i + 1;
      while (j < n && ((content[j] >= '0' && content[j] <= '9') || content[j] === '.')) j++;
      stack.push({ n: parseFloat(content.slice(i, j)) || 0 });
      i = j;
      continue;
    }

    // Single-char text operators ' and "
    if (ch === "'") {
      nextLine();
      const op = stack[stack.length - 1];
      if (op && 'str' in op) show(decode(op.str, op.hex));
      stack.length = 0;
      i++;
      continue;
    }
    if (ch === '"') {
      nextLine();
      const op = stack[stack.length - 1];
      if (op && 'str' in op) show(decode(op.str, op.hex));
      stack.length = 0;
      i++;
      continue;
    }

    // Operator token (letters, may include '*')
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
      let j = i + 1;
      while (j < n && ((content[j] >= 'A' && content[j] <= 'Z') || (content[j] >= 'a' && content[j] <= 'z') || content[j] === '*')) {
        j++;
      }
      const op = content.slice(i, j);
      i = j;

      switch (op) {
        case 'q':
          ctmStack.push(ctm);
          break;
        case 'Q':
          ctm = ctmStack.pop() ?? IDENTITY;
          break;
        case 'cm': {
          const [a, b, c, d, e, f] = nums(6);
          ctm = mul([a, b, c, d, e, f], ctm);
          break;
        }
        case 'BT':
          tm = IDENTITY;
          lm = IDENTITY;
          break;
        case 'ET':
          break;
        case 'Tm': {
          const [a, b, c, d, e, f] = nums(6);
          tm = [a, b, c, d, e, f];
          lm = tm;
          break;
        }
        case 'Td': {
          const [tx, ty] = nums(2);
          lm = mul([1, 0, 0, 1, tx, ty], lm);
          tm = lm;
          break;
        }
        case 'TD': {
          const [tx, ty] = nums(2);
          leading = -ty;
          lm = mul([1, 0, 0, 1, tx, ty], lm);
          tm = lm;
          break;
        }
        case 'T*':
          nextLine();
          break;
        case 'TL':
          leading = nums(1)[0];
          break;
        case 'Tf': {
          fontSize = nums(1)[0];
          // Tf names the font as well as sizing it, and the name is what says
          // which /ToUnicode table turns this stream's codes back into text.
          const named = [...stack].reverse().find((op) => 'name' in op);
          if (named && 'name' in named) {
            font = fonts.get(named.name);
          }
          break;
        }
        case 'Tj': {
          const top = stack[stack.length - 1];
          if (top && 'str' in top) show(decode(top.str, top.hex));
          break;
        }
        case 'TJ': {
          const a = stack[stack.length - 1];
          if (a && 'a' in a) show(textFromTJArray(a.a, decode));
          break;
        }
        case 'BI':
          // Inline image — skip its binary payload to the EI marker.
          i = skipInlineImage(content, i);
          break;
        default:
          break;
      }
      stack.length = 0;
      continue;
    }

    // Anything else (stray delimiter): skip.
    i++;
  }

  return runs;
}

/** Strip control characters that subset fonts sometimes leak into runs. */
function sanitizeRun(str: string): string {
  return str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/[\r\n]+/g, ' ');
}

function isDelimiter(c: string): boolean {
  return (
    c === ' ' ||
    c === '\n' ||
    c === '\r' ||
    c === '\t' ||
    c === '\f' ||
    c === '\0' ||
    c === '(' ||
    c === ')' ||
    c === '<' ||
    c === '>' ||
    c === '[' ||
    c === ']' ||
    c === '{' ||
    c === '}' ||
    c === '/' ||
    c === '%'
  );
}

/** Read a literal string starting at "(" (handles nesting + escapes). */
function readLiteral(content: string, start: number): { raw: string; end: number } {
  let depth = 0;
  let i = start;
  const n = content.length;
  for (; i < n; i++) {
    const c = content[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return { raw: content.slice(start, i), end: i };
}

/** Read an array starting at "[", stepping over nested strings/hex. */
function readArray(content: string, start: number): { raw: string; end: number } {
  let i = start + 1;
  const n = content.length;
  let out = '';
  while (i < n) {
    const c = content[i];
    if (c === ']') {
      i++;
      break;
    }
    if (c === '(') {
      const { raw, end } = readLiteral(content, i);
      out += raw;
      i = end;
      continue;
    }
    if (c === '<') {
      const gt = content.indexOf('>', i);
      out += gt === -1 ? '' : content.slice(i, gt + 1);
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    out += c;
    i++;
  }
  return { raw: out, end: i };
}

/** Skip a balanced "<<...>>" dictionary; returns the index just past it. */
function skipDict(content: string, start: number): number {
  let depth = 0;
  let i = start;
  const n = content.length;
  while (i < n) {
    if (content[i] === '<' && content[i + 1] === '<') {
      depth++;
      i += 2;
    } else if (content[i] === '>' && content[i + 1] === '>') {
      depth--;
      i += 2;
      if (depth === 0) break;
    } else {
      i++;
    }
  }
  return i;
}

/** Skip an inline image (BI ... ID <bytes> EI). */
function skipInlineImage(content: string, start: number): number {
  const ei = content.indexOf('EI', start);
  return ei === -1 ? content.length : ei + 2;
}

/** Concatenate the strings inside a TJ array, turning big kerns into spaces. */
function textFromTJArray(raw: string, decode: (value: string, hex: boolean) => string): string {
  const re = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]*)>|(-?\d*\.?\d+)/g;
  let text = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (m[1] !== undefined) {
      text += decode('(' + m[1] + ')', false);
    } else if (m[2] !== undefined) {
      text += decode(m[2], true);
    } else if (m[3] !== undefined) {
      // Negative displacement moves the pen right → a gap between words.
      if (parseFloat(m[3]) <= -120) text += ' ';
    }
  }
  return text;
}

// ---------------------------------------------------------------------------
// Positioned runs → reading-order lines
// ---------------------------------------------------------------------------

function linesFromRuns(runs: Run[]): PdfLine[] {
  if (runs.length === 0) return [];

  const sizes = runs
    .map((r) => r.size)
    .filter((s) => s > 0)
    .sort((a, b) => a - b);
  const medSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
  const charW = Math.max(medSize * 0.5, 1);
  const minX = Math.min(...runs.map((r) => r.x));

  // Reading order: top-to-bottom (PDF y grows upward), then left-to-right.
  runs.sort((a, b) => b.y - a.y || a.x - b.x);

  const lineTol = Math.max(medSize * 0.5, 2);
  const grouped: Run[][] = [];
  let current: Run[] = [];
  let currentY = runs[0].y;
  for (const r of runs) {
    if (current.length === 0 || Math.abs(r.y - currentY) <= lineTol) {
      current.push(r);
      // Track the top-most y of the line for stable grouping.
      if (current.length === 1) currentY = r.y;
    } else {
      grouped.push(current);
      current = [r];
      currentY = r.y;
    }
  }
  if (current.length) grouped.push(current);

  const out: PdfLine[] = [];
  let prevY: number | null = null;
  for (const group of grouped) {
    group.sort((a, b) => a.x - b.x);
    const y = group[0].y;
    const maxSize = Math.max(...group.map((r) => r.size));

    // Blank line(s) for a vertical gap larger than one line height.
    if (prevY !== null) {
      const gap = prevY - y;
      const blanks = Math.min(Math.max(Math.round(gap / medSize) - 1, 0), 2);
      for (let b = 0; b < blanks; b++) out.push({ text: '', heading: false, cells: [] });
    }
    prevY = y;

    // Lay the runs out horizontally, converting x-gaps into spaces so that
    // aligned columns line up under the monospace renderer.
    /**
     * How wide one character runs on this line, measured rather than guessed.
     *
     * A space belongs wherever a run starts further along than the previous one
     * ended, so everything depends on knowing how wide a character is — and
     * guessing it from the type size is wrong in both directions at once. Too
     * wide and words weld together ("de agosto" became "deagosto"); too narrow
     * and every letter is pushed apart ("CUU" became "C U U"), which is the
     * same damage as before by another route.
     *
     * The line already knows the answer: the distance between one run's start
     * and the next's, over the characters in between. Taking the median across
     * the line ignores the word gaps — most steps are within a word — and
     * calibrates to this line's actual face and size.
     */
    const steps: number[] = [];
    for (let k = 0; k + 1 < group.length; k++) {
      const step = (group[k + 1].x - group[k].x) / Math.max(group[k].text.length, 1);
      if (step > 0.01) steps.push(step);
    }
    steps.sort((a, b) => a - b);
    const measured = steps.length ? steps[Math.floor(steps.length / 2)] : charW;

    /**
     * Held to a plausible character width for the type on this line.
     *
     * The measurement is only meaningful where runs sit next to each other. On
     * a row of short values spread across columns — "1    2    27 D    1" — the
     * typical step is a column gap rather than a letter, so the unit came out
     * enormous, no gap could ever exceed it, and the whole row ran together as
     * "1227 D1". Bounding it by the type size keeps the calibration where it
     * helps and discards it where it is measuring the wrong thing.
     */
    const groupSizes = group.map((r) => r.size).filter((v) => v > 0).sort((a, b) => a - b);
    const lineSize = groupSizes.length ? groupSizes[Math.floor(groupSizes.length / 2)] : medSize;
    const unit = Math.min(Math.max(measured, lineSize * 0.3), lineSize * 0.75);

    let text = '';
    let penX = minX;
    const cells: { x: number; text: string }[] = [];
    for (const r of group) {
      const gap = r.x - penX;
      // The document's own spaces carry the word breaks now, so this only has
      // to reproduce column gaps. Held high, because a low bar re-introduces
      // the splits inside words that the spaces already settle.
      if (gap > unit * 0.9) {
        text += ' '.repeat(Math.min(Math.max(Math.round(gap / unit), 1), 60));
      }
      text += r.text;
      // A gap this wide is a column boundary, not a word space.
      if (!cells.length || gap > unit * 2.5) cells.push({ x: r.x, text: r.text });
      else cells[cells.length - 1].text += (gap > unit * 0.9 ? ' ' : '') + r.text;
      penX = r.x + r.text.length * unit;
    }
    text = text.replace(/\s+$/, '');
    if (text.length === 0) continue;

    const heading = maxSize >= medSize * 1.35 && text.trim().length <= 64;
    out.push({
      text,
      heading,
      cells: cells.map((c) => ({ x: c.x, text: c.text.trim() })).filter((c) => c.text),
    });
  }

  // Trim leading/trailing blank lines.
  while (out.length && out[0].text === '') out.shift();
  while (out.length && out[out.length - 1].text === '') out.pop();
  return out;
}

/** Decode a PDF literal string "(...)" including escape sequences. */
function decodePdfString(literal: string): string {
  const body = literal.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const nx = body[++i];
    if (nx === 'n') out += '\n';
    else if (nx === 'r') out += '\r';
    else if (nx === 't') out += ' ';
    else if (nx === 'b' || nx === 'f') out += '';
    else if (nx >= '0' && nx <= '7') {
      let oct = nx;
      while (oct.length < 3 && body[i + 1] >= '0' && body[i + 1] <= '7') oct += body[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += nx ?? '';
  }
  // UTF-16BE marker
  if (out.charCodeAt(0) === 0xfe && out.charCodeAt(1) === 0xff) {
    let utf = '';
    for (let i = 2; i + 1 < out.length; i += 2) {
      utf += String.fromCharCode((out.charCodeAt(i) << 8) | out.charCodeAt(i + 1));
    }
    return utf;
  }
  return out;
}

/** Decode a hex string "<...>" — only when it looks like real text. */
function decodeHexString(hex: string): string {
  const clean = hex.replace(/\s/g, '');
  let out = '';
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  if (out.charCodeAt(0) === 0xfe && out.charCodeAt(1) === 0xff) {
    let utf = '';
    for (let i = 2; i + 1 < out.length; i += 2) {
      utf += String.fromCharCode((out.charCodeAt(i) << 8) | out.charCodeAt(i + 1));
    }
    out = utf;
  }
  // Subset-encoded CID fonts produce control garbage — only keep printable runs
  const printable = out.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  return printable.length >= out.length * 0.8 ? printable : '';
}

// ---------------------------------------------------------------------------
// Fonts: turning glyph codes back into characters
// ---------------------------------------------------------------------------

interface PdfFont {
  /** Identity-H and friends address glyphs with two bytes, not one. */
  twoByte: boolean;
  /** Glyph code → text, from the font's own /ToUnicode table. */
  cmap: Map<number, string> | null;
}

/** Byte offset of every "N 0 obj" in the file. */
function indexObjects(raw: string): Map<number, number> {
  const offsets = new Map<number, number>();
  const re = /(\d+)\s+0\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) offsets.set(parseInt(m[1], 10), m.index);
  return offsets;
}

/** An indirect object's dictionary, and its stream if it carries one. */
function objectAt(
  raw: string,
  bytes: Uint8Array,
  offsets: Map<number, number>,
  num: number
): { dict: string; stream: string | null } | null {
  const start = offsets.get(num);
  if (start === undefined) return null;
  const endObj = raw.indexOf('endobj', start);
  const body = raw.slice(start, endObj === -1 ? start + 200_000 : endObj);

  const streamAt = body.indexOf('stream');
  if (streamAt === -1) return { dict: body, stream: null };
  const dict = body.slice(0, streamAt);

  let dataStart = start + streamAt + 6;
  if (raw[dataStart] === '\r') dataStart++;
  if (raw[dataStart] === '\n') dataStart++;
  const endStream = raw.indexOf('endstream', dataStart);
  if (endStream === -1) return { dict, stream: null };
  let dataEnd = endStream;
  while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)) {
    dataEnd--;
  }

  try {
    const data = bytes.subarray(dataStart, dataEnd);
    return { dict, stream: /\/FlateDecode/.test(dict) ? latin1(inflate(data)) : latin1(data) };
  } catch {
    return { dict, stream: null };
  }
}

function hexToText(hex: string): string {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    if (!Number.isNaN(code)) out += String.fromCharCode(code);
  }
  return out;
}

/**
 * A /ToUnicode CMap: what each glyph code in this font actually says.
 *
 * Read line by line rather than with one pattern over the block, because the
 * two forms interleave — a `bfrange` whose destinations are an array sits
 * beside plain triples, and a pattern loose enough for both pairs up the wrong
 * angle brackets across neighbouring entries.
 */
function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const CHARS = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/;
  const RANGE = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/;
  const LIST = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]*)\]/;

  let mode: 'char' | 'range' | null = null;
  for (const line of cmap.split(/[\r\n]+/)) {
    if (line.includes('beginbfchar')) { mode = 'char'; continue; }
    if (line.includes('beginbfrange')) { mode = 'range'; continue; }
    if (line.includes('endbfchar') || line.includes('endbfrange')) { mode = null; continue; }
    if (!mode) continue;

    if (mode === 'char') {
      const m = CHARS.exec(line);
      if (m) map.set(parseInt(m[1], 16), hexToText(m[2]));
      continue;
    }

    const list = LIST.exec(line);
    if (list) {
      const from = parseInt(list[1], 16);
      const items = list[3].match(/[0-9A-Fa-f]+/g) ?? [];
      items.forEach((item, i) => map.set(from + i, hexToText(item)));
      continue;
    }
    const range = RANGE.exec(line);
    if (range) {
      const from = parseInt(range[1], 16);
      const to = parseInt(range[2], 16);
      const base = parseInt(range[3], 16);
      // a subset font is small; the guard is against a corrupt span
      for (let code = from; code <= to && code - from < 4096; code++) {
        map.set(code, String.fromCharCode(base + (code - from)));
      }
    }
  }
  return map;
}

/**
 * Every font in the file, by the name a content stream calls it.
 *
 * Names are per-page in theory, but a pass is a page or two and reuses F1, F2…
 * for the same faces throughout. Keying on the name is what lets `Tf` in the
 * content stream pick the right table.
 */
function buildFonts(raw: string, bytes: Uint8Array): Map<string, PdfFont> {
  const offsets = indexObjects(raw);
  const fonts = new Map<string, PdfFont>();
  const resources = /\/Font\s*<<([\s\S]{0,2000}?)>>/g;

  let block: RegExpExecArray | null;
  while ((block = resources.exec(raw))) {
    const entry = /\/([A-Za-z0-9#+.\-]+)\s+(\d+)\s+0\s+R/g;
    let ref: RegExpExecArray | null;
    while ((ref = entry.exec(block[1]))) {
      const name = ref[1];
      if (fonts.has(name)) continue;
      const font = objectAt(raw, bytes, offsets, parseInt(ref[2], 10));
      if (!font) continue;

      const toUnicode = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(font.dict);
      let cmap: Map<number, string> | null = null;
      if (toUnicode) {
        const table = objectAt(raw, bytes, offsets, parseInt(toUnicode[1], 10));
        if (table?.stream) cmap = parseToUnicode(table.stream);
      }
      fonts.set(name, {
        twoByte: /\/Type0/.test(font.dict) || /Identity-[HV]/.test(font.dict),
        cmap: cmap && cmap.size ? cmap : null,
      });
    }
  }
  return fonts;
}

function normalize(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const WORDISH = /[A-Z0-9]/;

const FOLDED: Record<string, string> = {
  Á: 'A', À: 'A', Â: 'A', Ä: 'A', Ã: 'A', Å: 'A',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I',
  Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O', Õ: 'O',
  Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U',
  Ñ: 'N', Ç: 'C',
};

/**
 * Upper-case and strip accents, one character in for one character out.
 *
 * Matching against a folded copy means "Código de reservación" and "CODIGO DE
 * RESERVACION" are the same string to us, so the word lists carry one spelling
 * instead of every way a PDF encoder might have written it. Keeping the length
 * identical is what lets a position found in the folded text be used to cut the
 * value out of the original, accents and all — the card shows "AOÛT", we just
 * do not have to match on it.
 *
 * The ß is special-cased because upper-casing it yields two characters, which
 * would slide every position after it along by one.
 */
function fold(value: string): string {
  let out = '';
  for (const ch of value) {
    const upper = ch === 'ß' ? 'S' : ch.toUpperCase();
    const single = upper.length === 1 ? upper : ch;
    out += FOLDED[single] ?? single;
  }
  return out;
}

/** Match on the folded copy, return the slices from the original. */
function matchFolded(source: string, folded: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of folded.matchAll(re)) {
    if (m.index === undefined) continue;
    out.push(source.slice(m.index, m.index + m[0].length).trim());
  }
  return out;
}

/**
 * Read values sitting beside the captions the document printed.
 *
 * Works off the reconstructed lines rather than the flattened text, because the
 * value belongs to the caption it shares a line with. Where a caption ends its
 * line, the value is taken from the line below — a column heading with its
 * value underneath is as common on a ticket as a caption with a colon.
 */

/**
 * Month names in the languages a ticket is likely to be printed in.
 *
 * The list was English-only, so a Spanish boarding pass dated "15 ENE 2026" or
 * "3 DIC" carried no date at all — and since every field on the card is filled
 * from these, one missing pattern empties the whole pass. Accented and plain
 * spellings are both here because whether a PDF's text survives with its
 * accents depends on how it was encoded, not on what language it is in.
 */
const MONTH_WORDS = [
  // English
  'JAN', 'JANUARY', 'FEB', 'FEBRUARY', 'MAR', 'MARCH', 'APR', 'APRIL', 'MAY',
  'JUN', 'JUNE', 'JUL', 'JULY', 'AUG', 'AUGUST', 'SEP', 'SEPT', 'SEPTEMBER',
  'OCT', 'OCTOBER', 'NOV', 'NOVEMBER', 'DEC', 'DECEMBER',
  // Spanish
  'ENE', 'ENERO', 'FEBRERO', 'MARZO', 'ABR', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
  'AGO', 'AGOSTO', 'SEPTIEMBRE', 'SET', 'OCTUBRE', 'NOVIEMBRE', 'DIC', 'DICIEMBRE',
  // Portuguese
  'FEV', 'FEVEREIRO', 'MARCO', 'MAI', 'MAIO', 'JUNHO', 'JULHO',
  'SETEMBRO', 'OUT', 'OUTUBRO', 'NOVEMBRO', 'DEZ', 'DEZEMBRO',
  // French
  'JANV', 'JANVIER', 'FEVR', 'FEVRIER', 'AVR', 'AVRIL', 'JUIN', 'JUIL',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'DECEMBRE',
  // Italian
  'GEN', 'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAG', 'MAGGIO', 'GIU',
  'GIUGNO', 'LUG', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTT', 'OTTOBRE',
  'DICEMBRE',
  // German
  'JANUAR', 'FEBRUAR', 'MARZ', 'JUNI', 'JULI', 'OKT', 'OKTOBER', 'DEZ',
  'DEZEMBER',
];

// Longest first, so SEPTIEMBRE is not swallowed by SEP.
const MONTHS = [...new Set(MONTH_WORDS)].sort((a, b) => b.length - a.length).join('|');

function mineFields(text: string) {
  // Folded, so an accented month still matches; the slices come back off the
  // original text, so what the card shows keeps its accents.
  const upper = fold(text);

  const dates = unique([
    ...matchFolded(text, upper, new RegExp(`\\b\\d{1,2}[ \\/\\-.](?:${MONTHS})[ \\/\\-.,]?\\s?\\d{2,4}\\b`, 'g')),
    // Spanish and Portuguese join the parts with a word: "29 de agosto, 2025"
    ...matchFolded(
      text,
      upper,
      new RegExp(`\\b\\d{1,2}\\s+DE\\s+(?:${MONTHS})\\s*(?:DE\\s+|,\\s*)?\\d{2,4}\\b`, 'g')
    ),
    ...matchFolded(text, upper, new RegExp(`\\b(?:${MONTHS})[A-Z]*[ \\/\\-.,]\\s?\\d{1,2}[ ,]+\\d{2,4}\\b`, 'g')),
    ...matchAll(text, /\b\d{4}-\d{2}-\d{2}\b/g),
    ...matchAll(text, /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g),
  ]);

  const times = unique(matchAll(text, /\b([01]?\d|2[0-3]):[0-5]\d(?:\s?[AP]M)?\b/gi)).map((t) =>
    t.toUpperCase()
  );

  // Airline-style flight numbers: two letters (or letter+digit) + 1-4 digits
  const flights = unique(matchAll(upper, /\b(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{2,4}\b/g)).filter(
    (f) => !/^\d+$/.test(f.replace(/\s/g, ''))
  );

  // Booking refs / PNRs: 6-8 char uppercase alphanumeric containing both letters and digits
  const references = unique(matchAll(upper, /\b[A-Z0-9]{6,8}\b/g)).filter(
    (r) => /[A-Z]/.test(r) && /\d/.test(r) && !flights.includes(r)
  );

  /**
   * Money, with the symbol on either side and the separators either way round.
   *
   * Most of Europe writes "1.234,56 €" — the symbol trailing and the decimal a
   * comma — which the leading-symbol pattern could not see at all.
   */
  const amounts = unique([
    ...matchAll(text, /(?:[$€£]|USD|EUR|GBP|MXN|BRL|CHF)\s?\d[\d.,]*\d/g),
    // the symbol and the code need different endings: \b after "€" can never
    // match, because a word boundary wants a word character on one side of it
    ...matchAll(text, /\d[\d.,]*\d\s?[$€£]/g),
    ...matchAll(text, /\d[\d.,]*\d\s?(?:EUR|USD|GBP|MXN|BRL|CHF)\b/g),
  ]);

  return {
    dates: dates.slice(0, 6),
    times: times.slice(0, 6),
    flights: flights.slice(0, 6),
    references: references.slice(0, 6),
    amounts: amounts.slice(0, 4),
  };
}

/**
 * Captions a pass prints beside its values, per field, longest first.
 *
 * This is the part that makes the reading language-aware in the way that
 * matters. Scraping by shape alone — "something that looks like a flight
 * number", "the first time of day on the page" — works until a document puts
 * two of the same shape on it, and then the card shows whichever came first.
 * A document that captions its own fields is telling us which is which, and it
 * does that in its own language.
 */
const LABEL_WORDS: { key: PassLabelKey; words: string[] }[] = [
  {
    key: 'booking',
    words: [
      'BOOKING REFERENCE', 'RECORD LOCATOR', 'RESERVATION NUMBER',
      // Spain says reserva, most of Latin America says reservación
      'CODIGO DE RESERVACION', 'NUMERO DE RESERVACION', 'CLAVE DE RESERVACION',
      'CODIGO DE CONFIRMACION', 'NUMERO DE CONFIRMACION',
      'CODIGO DE RESERVA', 'NUMERO DE RESERVA', 'REFERENCIA DE RESERVA',
      'CLAVE DE RESERVA', 'REFERENCE DE RESERVATION', 'CODICE DI PRENOTAZIONE',
      'BUCHUNGSNUMMER', 'BUCHUNGSCODE', 'LOCALIZADOR', 'RESERVACION',
      'CONFIRMACION', 'RESERVATION', 'PRENOTAZIONE', 'RESERVA', 'BOOKING', 'PNR',
    ],
  },
  {
    key: 'flight',
    words: [
      'FLIGHT NUMBER', 'NUMERO DE VUELO', 'NRO DE VUELO', 'NO DE VUELO',
      'NUMERO DE VOL', 'NUMERO DI VOLO', 'FLUGNUMMER', 'NUMERO DO VOO',
      'FLIGHT', 'VUELO', 'VOLO', 'VOO', 'FLUG', 'VOL',
    ],
  },
  {
    key: 'departure',
    words: [
      'DEPARTURE TIME', 'HORA DE SALIDA', 'HORA SALIDA', 'HEURE DE DEPART',
      'ORA DI PARTENZA', 'ABFLUGZEIT', 'HORA DE PARTIDA',
      'DEPARTURE', 'DEPARTS', 'SALIDA', 'DEPART', 'PARTENZA', 'ABFLUG',
      'PARTIDA', 'SALE',
    ],
  },
  {
    key: 'arrival',
    words: [
      'ARRIVAL TIME', 'HORA DE LLEGADA', 'HORA LLEGADA', 'HEURE D ARRIVEE',
      'ORA DI ARRIVO', 'ANKUNFTSZEIT', 'HORA DE CHEGADA',
      'ARRIVAL', 'ARRIVES', 'LLEGADA', 'ARRIVEE', 'ARRIVO', 'ANKUNFT',
      'CHEGADA', 'LLEGA',
    ],
  },
  {
    key: 'passenger',
    words: [
      'PASSENGER NAME', 'NOMBRE DEL PASAJERO', 'NOMBRE DEL VIAJERO',
      'NOM DU PASSAGER', 'NOME DEL PASSEGGERO', 'NAME DES PASSAGIERS',
      'NOME DO PASSAGEIRO', 'PASSENGER', 'PASAJERO', 'PASSAGER', 'PASSEGGERO',
      'PASSAGIER', 'PASSAGEIRO', 'VIAJERO',
    ],
  },
  { key: 'seat', words: ['NUMERO DE ASIENTO', 'SEAT', 'ASIENTO', 'SIEGE', 'POSTO', 'SITZPLATZ', 'SITZ', 'ASSENTO', 'LUGAR'] },
  { key: 'gate', words: ['GATE', 'PUERTA DE EMBARQUE', 'PUERTA', 'PORTE', 'PORTA', 'FLUGSTEIG'] },
  {
    key: 'boarding',
    words: [
      'HORA DE ABORDAJE', 'HORA DE EMBARQUE', 'BOARDING TIME', 'HEURE EMBARQUEMENT',
      'ABORDAJE', 'EMBARQUE', 'BOARDING',
    ],
  },
  { key: 'terminal', words: ['TERMINAL'] },
  {
    key: 'date',
    words: ['FLIGHT DATE', 'FECHA DE VUELO', 'FECHA DEL VUELO', 'FECHA DE SALIDA', 'DATE DU VOL', 'FECHA', 'DATE', 'DATA', 'DATUM'],
  },
];

/**
 * The captions, folded and ordered longest first.
 *
 * Order decides which caption claims a line: "codigo de reservacion" has to be
 * tried before "reserva", or the shorter word matches inside the longer one and
 * the value is cut from the wrong place.
 */
const LABELS = LABEL_WORDS.map(({ key, words }) => ({
  key,
  words: words.map((word) => fold(word)).sort((a, b) => b.length - a.length),
}));

/**
 * Every caption, folded, for finding where one value ends and the next begins.
 *
 * Exported because anything else reading values off a document needs to know
 * what a caption looks like too — a line that names a neighbouring field is
 * never the value it was looking for.
 */
export const ALL_CAPTIONS = LABELS.flatMap(({ words }) => words);

const HAS_TIME = /\b([01]?\d|2[0-3]):[0-5]\d/;

/**
 * Captions whose value has to be a clock time.
 *
 * "Fecha de salida" and "Hora de salida" both contain SALIDA, and the date line
 * usually comes first — so without this the departure field was claimed by a
 * date and the real departure time, further down the page, never got a look.
 */
const NEEDS_TIME = new Set<PassLabelKey>(['departure', 'arrival', 'boarding']);

/**
 * What a value has to look like to be believed.
 *
 * A caption can turn up inside ordinary prose — an Italian museum ticket says
 * "Booking ➤ Show ID at the entrance" — and without a shape to check against,
 * the sentence after it becomes the booking reference. These fields all have
 * predictable forms, so checking costs nothing and a value that fails simply
 * leaves the field to the pattern search that would have filled it before.
 */
const VALUE_SHAPE: Partial<Record<PassLabelKey, RegExp>> = {
  booking: /^[A-Za-z0-9][A-Za-z0-9-]{4,19}$/,
  flight: /^[A-Za-z0-9]{2}\s?\d{1,4}$/,
  seat: /^\d{1,3}\s?[A-Za-z]$/,
  gate: /^[A-Za-z]?\d{1,3}[A-Za-z]?$/,
  terminal: /^[A-Za-z0-9]{1,3}$/,
};

/**
 * A line split into cells, each with the column it starts at.
 *
 * Two or more spaces is a column break; a single space is part of a value
 * ("Y4 3291", "27 D"). The start offset is what matters — it is how a caption
 * in one row is matched to its value in the row below.
 */
function cells(line: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  let at = 0;
  for (const part of line.split(/(\s{2,})/)) {
    const text = part.trim();
    if (text) out.push({ start: at, text });
    at += part.length;
  }
  return out;
}

/** True when a cell is itself a caption — the tail of one that wrapped. */
function isCaption(text: string): boolean {
  const folded = fold(text);
  return ALL_CAPTIONS.some((caption) => caption === folded);
}

/** Where the next caption starts in a folded tail, or its length. */
function nextCaptionAt(tail: string): number {
  let cut = tail.length;
  for (const caption of ALL_CAPTIONS) {
    const at = tail.indexOf(caption);
    if (at <= 0 || at >= cut) continue;
    const after = tail[at + caption.length];
    if (!WORDISH.test(tail[at - 1]) && (!after || !WORDISH.test(after))) cut = at;
  }
  return cut;
}

/** Letters that can be part of a word once folded. */
function mineLabels(lines: PdfLine[]): PassLabels {
  const found: PassLabels = {};
  const rows = lines.map((line) => line.cells).filter((cells) => cells.length);

  rows.forEach((row, index) => {
    for (const cell of row) {
      const upper = fold(cell.text);

      for (const { key, words } of LABELS) {
        if (found[key]) continue;

        for (const word of words) {
          const at = upper.indexOf(word);
          if (at === -1) continue;
          // whole word only, or "VOL" matches inside "VOLVER"
          if (at > 0 && WORDISH.test(upper[at - 1])) continue;
          const after = upper[at + word.length];
          if (after && WORDISH.test(after)) continue;

          const from = at + word.length;
          // Stop where the next caption begins — "Départ : 06:55  Arrivée :
          // 08:40" puts two of them in one cell.
          const tail = cell.text.slice(from, from + nextCaptionAt(upper.slice(from)));
          const sameCell = tail.replace(/^[\s:.\-–—/|]+/, '').trim();

          /**
           * Otherwise the value is in the row below, in this caption's column.
           *
           * Followed by page position rather than by offset in the rebuilt
           * line: each line measures its own character width, so the same
           * column sits at a different offset on each row and a caption picked
           * up its neighbour's value. Rows in between may be the rest of a
           * caption that wrapped — "Código de / reservación" — so keep going
           * until something that is not itself a caption turns up.
           */
          let value = sameCell;
          for (let ahead = 1; !value && ahead <= 3; ahead++) {
            const below = rows[index + ahead];
            if (!below?.length) continue;
            const nearest = below.reduce((best, c) =>
              Math.abs(c.x - cell.x) < Math.abs(best.x - cell.x) ? c : best
            );
            if (!nearest.text || isCaption(nearest.text)) continue;
            if (NEEDS_TIME.has(key) && !HAS_TIME.test(nearest.text)) continue;
            value = nearest.text;
          }

          const shape = VALUE_SHAPE[key];
          if (
            value &&
            value.length <= 40 &&
            (!NEEDS_TIME.has(key) || HAS_TIME.test(value)) &&
            (!shape || shape.test(value))
          ) {
            found[key] = value;
          }
          break;
        }
      }
    }
  });

  return found;
}

function matchAll(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re), (m) => m[0].trim());
}

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr));
}
