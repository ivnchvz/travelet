import { PDFCategory } from '../../services/PDFService';

export type ObjectType = 'passport' | 'boardingPass' | 'visa' | 'insurance' | 'folder';

export interface ObjectSpec {
  /** Which edge the cover is hinged on when opening */
  hinge: 'left' | 'top';
  /**
   * Where that hinge sits on the opened object: 'center' for things that
   * fold in half (book spine, wallet stitch), 'edge' for flaps that hinge
   * on the opened surface's own edge (sleeve, folder, form).
   */
  hingeAnchor: 'center' | 'edge';
  /** How far the cover swings open, in degrees */
  openDeg: number;
  /**
   * Cover width as a fraction of the available item width. Kept equal to
   * `open.widthPct` so an object doesn't change size as it opens — the
   * exception is the passport, which sits small on the shelf, as a passport
   * does among looser papers, and opens out to the full width.
   */
  widthPct: number;
  /** Cover aspect ratio (width / height) */
  aspect: number;
  /** Corner radius of the physical object */
  radius: number;
  /** Color of the inside face of the cover (visible once opened) */
  coverBack: string;
  /** Size of the object once opened (book spread, unfolded wallet, …) */
  open: {
    widthPct: number;
    aspect: number;
  };
  interior: {
    bg: string;
    text: string;
    accent: string;
    /**
     * Multi-stop tint for the glass surfaces — the pass and its miniature.
     * A flat accent looks dead behind blur; several related shades give the
     * material somewhere to catch light.
     */
    gradient: string[];
    line: string;
    decor: 'stamps' | 'ruled' | 'none';
  };
}

export const OBJECT_SPECS: Record<ObjectType, ObjectSpec> = {
  passport: {
    hinge: 'left',
    /**
     * On the edge, not the spine.
     *
     * A centre anchor is for a real two-page spread, where the spine belongs
     * down the middle. This opens onto the same single fan of documents every
     * other object opens onto, so a centre hinge put the pivot half way across
     * the contents — the cover turned about a line through the middle of the
     * papers instead of swinging off their edge.
     */
    hingeAnchor: 'edge',
    // far enough to swing clear of the surface; the 178 it opened to before was
    // for laying a book flat against its own endpaper
    openDeg: 155,
    /**
     * Wide enough to be a cover for the papers inside it.
     *
     * The document cards are one size for the whole app, and at 0.5 this was
     * the only object narrower and shorter than the cards it holds — a book
     * whose pages overhang its boards. Still the smallest thing on the shelf,
     * which is the point of it, just no longer smaller than its own contents.
     */
    widthPct: 0.6,
    aspect: 0.72,
    radius: 14,
    // the back of the same uncoated grey board the cover is cut from, a shade
    // down so the fold reads as a fold
    coverBack: '#777773',
    open: { widthPct: 1.0, aspect: 0.94 },
    interior: {
      bg: '#f6efdf',
      text: '#5a4632',
      accent: '#b08d57',
      gradient: ['#e8c583', '#cfa257', '#b0803c', '#8f632c', '#6d4820', '#4a2f14'],
      line: '#e3d7bd',
      decor: 'stamps',
    },
  },
  boardingPass: {
    hinge: 'top',
    hingeAnchor: 'edge',
    openDeg: 150,
    widthPct: 1.0,
    aspect: 2.1,
    radius: 16,
    coverBack: '#f0fdf4',
    open: { widthPct: 1.0, aspect: 0.9 },
    interior: {
      bg: '#fdfdf8',
      text: '#14532d',
      accent: '#16a34a',
      gradient: ['#4ade80', '#22c55e', '#10b981', '#059669', '#047857', '#065f46', '#0b3d2e'],
      line: '#dcfce7',
      decor: 'ruled',
    },
  },
  visa: {
    hinge: 'top',
    hingeAnchor: 'edge',
    openDeg: 148,
    widthPct: 1.0,
    aspect: 1.45,
    radius: 10,
    coverBack: '#dbeafe',
    open: { widthPct: 1.0, aspect: 0.88 },
    interior: {
      bg: '#f3f8ff',
      text: '#1e3a8a',
      accent: '#2563eb',
      gradient: ['#38bdf8', '#0ea5e9', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a', '#172554'],
      line: '#dbeafe',
      decor: 'none',
    },
  },
  insurance: {
    hinge: 'top',
    /**
     * On the edge, like everything else.
     *
     * A centre anchor puts the hinge half way down whatever it opens onto,
     * which is right for a bifold whose two halves each hold something. This
     * opens onto the same single fan of documents the other objects do, so the
     * cover was turning about a line through the middle of the papers instead
     * of lifting off the top of them — the same fault the passport had from
     * being specified as a book.
     */
    hingeAnchor: 'edge',
    openDeg: 150,
    widthPct: 0.96,
    aspect: 1.586,
    radius: 24,
    // the reverse of the same ivory stock, a shade down from the face
    coverBack: '#ded7c6',
    /**
     * Two panels of the bifold, opened out — which is also close enough to the
     * boarding pass and the visa that the papers inside land where they do in
     * those. At 0.7 the open face was a hundred points taller than its
     * siblings', which is why its contents needed placing by hand to sit
     * anywhere sensible. The width stays with the cover's, as the spec asks.
     */
    open: { widthPct: 0.96, aspect: 0.79 },
    interior: {
      bg: '#f4f1ff',
      text: '#4c1d95',
      accent: '#7c3aed',
      gradient: ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#2e1065'],
      line: '#e6e1fb',
      decor: 'none',
    },
  },
  folder: {
    hinge: 'left',
    hingeAnchor: 'edge',
    openDeg: 150,
    widthPct: 1.0,
    aspect: 0.84,
    radius: 10,
    coverBack: '#d9b87c',
    open: { widthPct: 1.0, aspect: 0.76 },
    interior: {
      bg: '#f3e3c0',
      text: '#7a5c2e',
      accent: '#b08948',
      gradient: ['#d9a95f', '#c08b43', '#a06f32', '#815726', '#61401b', '#432b11'],
      line: '#e6d3a8',
      decor: 'none',
    },
  },
};

export function getObjectType(category: PDFCategory): ObjectType {
  switch (category.id) {
    case 'passports':
      return 'passport';
    case 'boarding-passes':
      return 'boardingPass';
    case 'evisas':
      return 'visa';
    case 'insurance':
      return 'insurance';
    case 'other':
      return 'folder';
  }
  const n = category.name.toLowerCase();
  if (n.includes('passport') || n.includes(' id')) return 'passport';
  if (n.includes('board') || n.includes('ticket') || n.includes('flight')) return 'boardingPass';
  if (n.includes('visa')) return 'visa';
  if (n.includes('insur') || n.includes('medical') || n.includes('health')) return 'insurance';
  return 'folder';
}

/** Hex → rgba, for laying a colour over glass without hiding what's behind. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean,
    16
  );
  if (Number.isNaN(value)) return hex;
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
