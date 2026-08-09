import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import PDFService, { PDFDocument } from '@/services/PDFService';

/** The folder a boarding pass belongs in, and the name shown on its chip. */
const SAMPLE_CATEGORY = 'boarding-passes';
const SAMPLE_TRAVELER = 'Ana Garcia';

/**
 * A real boarding pass, shipped with the app.
 *
 * An empty shelf is the worst possible first impression of a wallet: five
 * closed folders and nothing to open. The obvious fix — a screenshot or a
 * drawing of a card — teaches nothing, because the whole point is what the app
 * does *to* a document. So this is an actual PDF, read by the same parser and
 * rendered by the same pipeline as anything imported, and it arrives as an
 * ordinary document that can be renamed, opened and thrown away like any
 * other.
 *
 * It matters for review as much as for first use. Someone evaluating the app
 * has no boarding passes on their device and no convenient way to get one
 * there; without this they would see the empty shelf and nothing else.
 */
export async function addSampleDocument(): Promise<PDFDocument | null> {
  if (Platform.OS === 'web') return null;

  try {
    const asset = Asset.fromModule(require('../assets/sample/boarding-pass.pdf'));
    await asset.downloadAsync();

    // Bundled assets can report a URI inside the app bundle that the picker's
    // copy step cannot read from directly, so it is staged in the cache first.
    const staged = `${FileSystem.cacheDirectory}sample-boarding-pass.pdf`;
    const source = asset.localUri ?? asset.uri;
    if (source !== staged) {
      await FileSystem.deleteAsync(staged, { idempotent: true }).catch(() => {});
      await FileSystem.copyAsync({ from: source, to: staged });
    }

    return await PDFService.addDocument(
      SAMPLE_CATEGORY,
      staged,
      'boarding-pass.pdf',
      SAMPLE_TRAVELER,
      'MAD → BCN · Sample'
    );
  } catch (error) {
    console.warn('Could not add the sample document:', error);
    return null;
  }
}

/** Where it lands, so the caller can open the right folder afterwards. */
export const SAMPLE_CATEGORY_ID = SAMPLE_CATEGORY;
