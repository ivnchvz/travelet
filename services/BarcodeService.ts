import Barcode, { DocumentPreview, ExtractedBarcode } from '@/modules/document-barcode';
import { Platform } from 'react-native';

export type DocumentBarcode = ExtractedBarcode;
export type { DocumentPreview };

const isAvailable = (): boolean => Platform.OS === 'ios' && Barcode != null;

export const isSupported = isAvailable;

/**
 * Pulls the ticket barcode out of a PDF, caching a high-resolution crop in the
 * App Group so both the peek and the Live Activity can render it.
 *
 * Three outcomes, and the difference matters for caching:
 *  - a barcode — found and cropped
 *  - `null` — scanned cleanly, the document has no symbol (normal for visas)
 *  - `undefined` — the scan itself couldn't run, so it should be retried later
 *    rather than remembered as "no barcode" forever
 */
export async function extract(
  filePath: string,
  documentId: string
): Promise<DocumentBarcode | null | undefined> {
  if (!isAvailable() || filePath.startsWith('web://')) return undefined;

  try {
    return await Barcode!.extract(filePath, documentId);
  } catch (error) {
    // A malformed or encrypted PDF shouldn't block adding the document, but it
    // also shouldn't be cached as a definitive "no barcode".
    console.warn('Barcode extraction failed:', error);
    return undefined;
  }
}

/**
 * Current location of a cached crop. Resolved on each read rather than trusting
 * the URI saved at extraction time, since the App Group container can move.
 */
export function uriFor(file: string | undefined | null): string | null {
  if (!isAvailable() || !file) return null;

  try {
    return Barcode!.uriFor(file);
  } catch {
    return null;
  }
}

/**
 * Page one as an image, for documents meant to be looked at rather than
 * scanned — passports and IDs carry nothing a scanner wants.
 */
export async function preview(
  filePath: string,
  documentId: string
): Promise<DocumentPreview | null | undefined> {
  if (!isAvailable() || filePath.startsWith('web://')) return undefined;

  try {
    return await Barcode!.preview(filePath, documentId);
  } catch (error) {
    console.warn('Preview render failed:', error);
    return undefined;
  }
}

/** Every page as an image, cached after the first render. */
export async function pages(filePath: string, documentId: string): Promise<DocumentPreview[]> {
  if (!isAvailable() || filePath.startsWith('web://')) return [];

  try {
    return await Barcode!.pages(filePath, documentId);
  } catch (error) {
    console.warn('Page render failed:', error);
    return [];
  }
}

export function removePreview(documentId: string): void {
  if (!isAvailable()) return;
  try {
    Barcode!.removePreview(documentId);
  } catch {
    // nothing to clean up
  }
}

export function remove(documentId: string): void {
  if (!isAvailable()) return;

  try {
    Barcode!.remove(documentId);
  } catch (error) {
    console.warn('Could not remove cached barcode:', error);
  }
}
