import { getObjectType, OBJECT_SPECS } from '@/components/physical/theme';
import LiveActivity from '@/modules/live-activity';
import { PDFCategory } from '@/services/PDFService';
import { Platform } from 'react-native';

export interface IslandDocument {
  id: string;
  name: string;
  traveler: string;
  fileSize: string;
  /** Bare filename in the App Group; the widget resolves it itself. */
  barcodeFile?: string;
  barcodeSymbology?: string;
}

export interface IslandCategory {
  id: string;
  name: string;
  tint: string;
  documents: IslandDocument[];
}

const isAvailable = (): boolean =>
  Platform.OS === 'ios' && LiveActivity != null && LiveActivity.isSupported();

/**
 * Live Activities only run on iOS 16.2+, and the interactive buttons in the
 * expanded island need iOS 17. Everything below no-ops elsewhere.
 */
export const isSupported = isAvailable;

export const areActivitiesEnabled = (): boolean =>
  isAvailable() && LiveActivity!.areActivitiesEnabled();

export const isRunning = (): boolean => isAvailable() && LiveActivity!.isRunning();

/**
 * Flattens categories into the shape the widget renders. Empty categories are
 * dropped so the island's `‹ ›` buttons and category chips never land on a dead
 * end — the widget indexes straight into this array.
 */
export function toCatalog(categories: PDFCategory[]): IslandCategory[] {
  return categories
    .filter((category) => category.documents.length > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      tint: OBJECT_SPECS[getObjectType(category)].interior.accent,
      documents: category.documents.map((document) => ({
        id: document.id,
        name: document.name,
        traveler: document.traveler ?? '',
        fileSize: document.fileSize ?? '',
        barcodeFile: document.barcode?.file,
        barcodeSymbology: document.barcode?.symbology,
      })),
    }));
}

/**
 * Pushes the current documents into the shared App Group, then nudges a running
 * activity so it re-renders.
 *
 * The nudge is required: a Live Activity view only re-renders when its state
 * changes, so without it the island would keep showing the documents as they
 * were when the activity started.
 */
export function syncCatalog(categories: PDFCategory[]): void {
  if (!isAvailable()) return;

  try {
    LiveActivity!.syncCatalog(JSON.stringify({ categories: toCatalog(categories) }));
    if (LiveActivity!.isRunning()) {
      LiveActivity!.refresh().catch((error) =>
        console.error('Error refreshing island:', error)
      );
    }
  } catch (error) {
    console.error('Error syncing island catalog:', error);
  }
}

export async function start(categoryIndex = 0): Promise<void> {
  if (!isAvailable()) return;
  await LiveActivity!.start(categoryIndex);
}

export async function stop(): Promise<void> {
  if (!isAvailable()) return;
  await LiveActivity!.stop();
}

/** Index into the synced catalog, which skips empty categories. */
export function catalogIndexOf(categories: PDFCategory[], categoryId: string): number {
  const index = toCatalog(categories).findIndex((category) => category.id === categoryId);
  return index < 0 ? 0 : index;
}
