import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parsePassMoment } from './FlightSchedule';
import { PDFCategory, PDFDocument } from './PDFService';
import { extractPdfInsights, PassLabels } from './PDFTextService';

/**
 * Reminders for a flight the app already knows about.
 *
 * Everything here is built from what was read off the pass itself — no network,
 * no account, no airline API. The reminders are local: they are scheduled on
 * the device and fire there, which also means they survive the app being shut.
 */

/** When to speak up, relative to the moment the flight boards. */
const REMINDERS: { key: string; before: number; title: (f: Flight) => string; body: (f: Flight) => string }[] = [
  {
    key: 'day',
    before: 20 * 60 * 60 * 1000,
    title: (f) => `Tomorrow: ${f.journey}`,
    body: (f) => `${f.flight ?? 'Your flight'} boards at ${f.boardsAt}.${f.seat ? ` Seat ${f.seat}.` : ''}`,
  },
  {
    key: 'leave',
    before: 3 * 60 * 60 * 1000,
    title: (f) => `${f.journey} — 3 hours to boarding`,
    body: (f) => `Time to leave for the airport. ${f.flight ?? ''} boards ${f.boardsAt}.`.trim(),
  },
  {
    key: 'boarding',
    before: 30 * 60 * 1000,
    title: (f) => `Boarding soon: ${f.journey}`,
    body: (f) =>
      [f.flight, f.gate && `gate ${f.gate}`, f.seat && `seat ${f.seat}`]
        .filter(Boolean)
        .join(' · ') || 'Head to the gate.',
  },
];

interface Flight {
  documentId: string;
  journey: string;
  flight?: string;
  gate?: string;
  seat?: string;
  boardsAt: string;
  boards: Date;
}

/** Marks the notifications this service owns, so it only ever cancels its own. */
const TAG = 'travelet-flight';

let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks once, and only when there is a reason to.
 *
 * Called from the sync below rather than at launch, so the prompt arrives when
 * a flight has actually been found — a permission dialog on first open, before
 * the app has done anything, is the kind a person refuses on principle.
 */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** The flight a boarding pass describes, if it says enough to be scheduled. */
function readFlight(document: PDFDocument, labels: PassLabels, route?: string): Flight | null {
  // Boarding is the useful anchor: it is what you have to be somewhere for.
  const boards = parsePassMoment(labels.date, labels.boarding ?? labels.departure);
  if (!boards) return null;

  return {
    documentId: document.id,
    journey: route ?? document.name,
    flight: labels.flight,
    gate: labels.gate,
    seat: labels.seat,
    boardsAt: (labels.boarding ?? labels.departure ?? '').trim(),
    boards,
  };
}

/**
 * Brings the scheduled reminders in line with the passes on the shelf.
 *
 * Every run clears what this service scheduled before and lays it down again.
 * Reconciling instead would mean tracking which notification belongs to which
 * document across edits and deletions, and there are at most a handful of
 * these — rebuilding is cheaper to run and far cheaper to reason about.
 */
export async function syncFlightReminders(categories: PDFCategory[]): Promise<number> {
  if (Platform.OS === 'web') return 0;
  configure();

  const passes = categories.find((c) => c.id === 'boarding-passes')?.documents ?? [];
  if (!passes.length) {
    await clearFlightReminders();
    return 0;
  }

  const now = Date.now();
  const flights: Flight[] = [];
  for (const document of passes) {
    const insights = await extractPdfInsights(document.filePath);
    const flight = readFlight(document, insights.labels, routeOf(insights.text));
    // A flight that has already left needs nothing said about it.
    if (flight && flight.boards.getTime() > now) flights.push(flight);
  }

  await clearFlightReminders();
  if (!flights.length) return 0;
  if (!(await ensurePermission())) return 0;

  let scheduled = 0;
  for (const flight of flights) {
    for (const reminder of REMINDERS) {
      const when = new Date(flight.boards.getTime() - reminder.before);
      if (when.getTime() <= now) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title(flight),
          body: reminder.body(flight),
          data: { tag: TAG, documentId: flight.documentId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
        },
      });
      scheduled++;
    }
  }
  return scheduled;
}

/** Drops every reminder this service scheduled, leaving anything else alone. */
export async function clearFlightReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((item) => item.content.data?.tag === TAG)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

/** "CUU → TIJ" out of the reconstructed text, for the reminder's title. */
function routeOf(text: string): string | undefined {
  const match = /\b([A-Z]{3})\s+([A-Z]{3})\b/.exec(text);
  if (!match || match[1] === match[2]) return undefined;
  return `${match[1]} → ${match[2]}`;
}
