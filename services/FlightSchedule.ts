/**
 * Turning what a pass says into a moment in time.
 *
 * A boarding pass prints its date and time for a person to read, in whatever
 * language it was issued in and whatever order that language puts the parts.
 * Everything here exists to get from that back to a Date, because a reminder
 * that cannot say *when* is not a reminder.
 */

/** Month names to their index, across the languages a pass is issued in. */
const MONTHS: Record<string, number> = {};
const MONTH_NAMES: string[][] = [
  ['JAN', 'JANUARY', 'ENE', 'ENERO', 'GEN', 'GENNAIO', 'JANV', 'JANVIER', 'JANUAR', 'JANEIRO'],
  ['FEB', 'FEBRUARY', 'FEBRERO', 'FEBBRAIO', 'FEVR', 'FEVRIER', 'FEBRUAR', 'FEV', 'FEVEREIRO'],
  ['MAR', 'MARCH', 'MARZO', 'MARS', 'MARZ', 'MARCO'],
  ['APR', 'APRIL', 'ABR', 'ABRIL', 'APRILE', 'AVR', 'AVRIL'],
  ['MAY', 'MAYO', 'MAG', 'MAGGIO', 'MAI', 'MAIO'],
  ['JUN', 'JUNE', 'JUNIO', 'GIU', 'GIUGNO', 'JUIN', 'JUNI', 'JUNHO'],
  ['JUL', 'JULY', 'JULIO', 'LUG', 'LUGLIO', 'JUIL', 'JUILLET', 'JULI', 'JULHO'],
  ['AUG', 'AUGUST', 'AGO', 'AGOSTO', 'AOUT', 'AGOSTO'],
  ['SEP', 'SEPT', 'SEPTEMBER', 'SEPTIEMBRE', 'SET', 'SETTEMBRE', 'SEPTEMBRE', 'SETEMBRO'],
  ['OCT', 'OCTOBER', 'OCTUBRE', 'OTT', 'OTTOBRE', 'OKT', 'OKTOBER', 'OUT', 'OUTUBRO'],
  ['NOV', 'NOVEMBER', 'NOVIEMBRE', 'NOVEMBRE', 'NOVEMBRO'],
  ['DEC', 'DECEMBER', 'DIC', 'DICIEMBRE', 'DICEMBRE', 'DECEMBRE', 'DEZ', 'DEZEMBER', 'DEZEMBRO'],
];
MONTH_NAMES.forEach((names, index) => {
  for (const name of names) MONTHS[name] = index;
});

const ACCENTS: Record<string, string> = {
  Á: 'A', À: 'A', Â: 'A', Ä: 'A', Ã: 'A',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I',
  Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O', Õ: 'O',
  Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U',
  Ñ: 'N', Ç: 'C',
};

function fold(value: string): string {
  let out = '';
  for (const ch of value.toUpperCase()) out += ACCENTS[ch] ?? ch;
  return out;
}

/** Two-digit years are this century; a pass is not a historical document. */
function fullYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}

/**
 * The day a pass is for.
 *
 * Numeric dates are read day-first. Most of the world writes them that way and
 * the app's own passes are Spanish and Italian, but it is a genuine ambiguity —
 * 07/07 is the same either way, 03/04 is not — so an unambiguous form is
 * always preferred when the document offers one.
 */
export function parsePassDate(text?: string): { year: number; month: number; day: number } | null {
  if (!text) return null;
  const value = fold(text);

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(value);
  if (iso) {
    return { year: +iso[1], month: +iso[2] - 1, day: +iso[3] };
  }

  // "29 de agosto, 2025" / "29 agosto 2025" / "15 ENE 2026"
  const dayFirst = /\b(\d{1,2})\s*(?:DE\s+)?[ \/\-.]?\s*([A-Z]{3,12})\.?\s*(?:DE\s+|,\s*)?(\d{2,4})?\b/.exec(value);
  if (dayFirst && MONTHS[dayFirst[2]] !== undefined) {
    return {
      year: dayFirst[3] ? fullYear(+dayFirst[3]) : new Date().getFullYear(),
      month: MONTHS[dayFirst[2]],
      day: +dayFirst[1],
    };
  }

  // "AGOSTO 29, 2025"
  const monthFirst = /\b([A-Z]{3,12})\.?\s*[ \/\-.,]?\s*(\d{1,2})\s*[ ,]+\s*(\d{2,4})\b/.exec(value);
  if (monthFirst && MONTHS[monthFirst[1]] !== undefined) {
    return { year: fullYear(+monthFirst[3]), month: MONTHS[monthFirst[1]], day: +monthFirst[2] };
  }

  const numeric = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/.exec(value);
  if (numeric) {
    const a = +numeric[1];
    const b = +numeric[2];
    // Whichever part cannot be a month settles the order; otherwise day first.
    const monthIsSecond = a > 12 || b <= 12;
    return {
      year: fullYear(+numeric[3]),
      month: (monthIsSecond ? b : a) - 1,
      day: monthIsSecond ? a : b,
    };
  }

  return null;
}

/** A clock time, 24-hour or with AM/PM. */
export function parsePassTime(text?: string): { hour: number; minute: number } | null {
  if (!text) return null;
  const match = /\b([01]?\d|2[0-3]):([0-5]\d)\s*([AP])?\.?M?\.?\b/i.exec(text);
  if (!match) return null;

  let hour = +match[1];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'P' && hour < 12) hour += 12;
  if (meridiem === 'A' && hour === 12) hour = 0;
  return { hour, minute: +match[2] };
}

/**
 * The date and time together, in the device's own zone.
 *
 * A pass prints local time at the airport and says nothing about the zone, so
 * this is only right for someone standing where the flight leaves from. That is
 * the common case and the alternative — guessing a zone from an airport code —
 * would be wrong more confidently.
 */
export function parsePassMoment(dateText?: string, timeText?: string): Date | null {
  const day = parsePassDate(dateText);
  if (!day) return null;
  const time = parsePassTime(timeText) ?? { hour: 0, minute: 0 };

  const when = new Date(day.year, day.month, day.day, time.hour, time.minute, 0, 0);
  return Number.isNaN(when.getTime()) ? null : when;
}
