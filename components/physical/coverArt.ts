import type { ImageSourcePropType } from 'react-native';
import { ObjectType } from './theme';

export interface CoverArt {
  source: ImageSourcePropType;
  /**
   * Whether the app still draws its own type over the artwork.
   *
   * 'keep' (the default) treats the image as the surface and leaves the labels
   * on top — which matters for the boarding pass, visa and folder, because
   * their type carries live data: the category's name and how many documents
   * are in it. Artwork that replaces those loses them.
   *
   * 'replace' hands the whole cover to the image. Right when the artwork
   * already contains its own lettering, or when the cover has no live data to
   * lose, as with the passport.
   */
  content?: 'keep' | 'replace';
}

/**
 * Drawn covers, used in place of the programmatic ones.
 *
 * Metro resolves `require` at bundle time from a literal path, so these can't
 * be looked up from a folder listing — an entry has to exist in the source for
 * the image to be bundled at all. Hence the commented lines: drop a file into
 * `assets/covers/` and uncomment its row. Anything left commented out falls
 * back to the version drawn in code, so the two can coexist while a set is
 * still being designed.
 *
 * See `assets/covers/README.md` for sizes, ratios and export settings.
 */
export const COVER_ART: Partial<Record<ObjectType, CoverArt>> = {
  // passport: { source: require('../../assets/covers/passport.png'), content: 'replace' },
  // insurance: { source: require('../../assets/covers/insurance.png'), content: 'replace' },
  // boardingPass: { source: require('../../assets/covers/boarding-pass.png') },
  // visa: { source: require('../../assets/covers/visa.png') },
  // folder: { source: require('../../assets/covers/folder.png') },
};

export function coverArtFor(type: ObjectType): CoverArt | undefined {
  return COVER_ART[type];
}

/** True when the app should still draw its own labels over the cover. */
export function drawsOwnContent(art: CoverArt | undefined): boolean {
  return !art || art.content !== 'replace';
}
