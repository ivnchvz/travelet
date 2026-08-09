export type SkyPhase = 'dawn' | 'morning' | 'midday' | 'golden' | 'dusk' | 'night';
export type SkyWeather = 'clear' | 'cloudy' | 'rain' | 'snow';

export interface SkyPalette {
  /** Sky gradient, top → horizon. Several stops of the same hues, so the wash
   *  reads as depth rather than as two colours meeting. */
  colors: readonly [string, string, ...string[]];
  /** sun / moon glow color */
  glow: string;
  /** where the glow sits */
  glowPosition: 'horizon' | 'high';
  cloud: string;
  cloudOpacity: number;
  /** rgb triplets for the readability overlays at top/bottom of the screen */
  topRGB: string;
  bottomRGB: string;
  /** header text colors that stay readable on this sky */
  text: string;
  subtext: string;
}

export const SKY: Record<SkyPhase, SkyPalette> = {
  dawn: {
    colors: ['#6d81ba', '#8093c7', '#a9a6d0', '#dcc8e0', '#f3d3c8', '#ffd9b0'],
    glow: '#ffb36b',
    glowPosition: 'horizon',
    cloud: '#fff4ec',
    cloudOpacity: 0.8,
    topRGB: '128,147,199',
    bottomRGB: '255,217,176',
    text: '#1c2440',
    subtext: '#3e4a70',
  },
  morning: {
    colors: ['#b6d2f9', '#c9defb', '#d9e6fc', '#e4edfd', '#eff1f2', '#f7efe3'],
    glow: '#ffcd8c',
    glowPosition: 'horizon',
    cloud: '#ffffff',
    cloudOpacity: 0.8,
    topRGB: '201,222,251',
    bottomRGB: '247,239,227',
    text: '#020403',
    subtext: '#6b7280',
  },
  midday: {
    colors: ['#79b3f2', '#8fc0f5', '#acd1f9', '#c9e2fc', '#dbebfe', '#eaf4ff'],
    glow: '#fff3c4',
    glowPosition: 'high',
    cloud: '#ffffff',
    cloudOpacity: 0.9,
    topRGB: '143,192,245',
    bottomRGB: '234,244,255',
    text: '#0b1f38',
    subtext: '#3c5878',
  },
  golden: {
    colors: ['#6b86c4', '#7e98cf', '#b6a9b4', '#eebd92', '#f7ac7c', '#ff9e66'],
    glow: '#ff8c42',
    glowPosition: 'horizon',
    cloud: '#fff1e2',
    cloudOpacity: 0.75,
    topRGB: '126,152,207',
    bottomRGB: '255,158,102',
    text: '#221a33',
    subtext: '#4c3f63',
  },
  dusk: {
    colors: ['#333d76', '#46518c', '#67629b', '#8a74ab', '#b98795', '#e89a7e'],
    glow: '#ff9d6e',
    glowPosition: 'horizon',
    cloud: '#c9bedf',
    cloudOpacity: 0.55,
    topRGB: '70,81,140',
    bottomRGB: '232,154,126',
    text: '#f1f3fa',
    subtext: '#d4d9ef',
  },
  night: {
    colors: ['#070d22', '#0c142e', '#141f40', '#1c2b52', '#273861', '#33446f'],
    glow: '#cfd9f7',
    glowPosition: 'high',
    cloud: '#46557e',
    cloudOpacity: 0.5,
    topRGB: '12,20,46',
    bottomRGB: '51,68,111',
    text: '#eef1fb',
    subtext: '#a8b2d1',
  },
};

export function getSkyPhase(date = new Date()): SkyPhase {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'midday';
  if (h >= 16 && h < 19) return 'golden';
  if (h >= 19 && h < 21.5) return 'dusk';
  return 'night';
}

/** Phase boundaries in hours, in the order the day runs through them. */
const PHASE_START: [SkyPhase, number][] = [
  ['dawn', 5],
  ['morning', 8],
  ['midday', 11],
  ['golden', 16],
  ['dusk', 19],
  ['night', 21.5],
];

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function parseHex(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(mixChannel(ar, br, t))}${hex(mixChannel(ag, bg, t))}${hex(mixChannel(ab, bb, t))}`;
}

function mixTriplet(a: string, b: string, t: number): string {
  const av = a.split(',').map(Number);
  const bv = b.split(',').map(Number);
  return av.map((v, i) => mixChannel(v, bv[i], t)).join(',');
}

/**
 * The sky for a given moment, blended between the phase it's in and the one
 * coming next.
 *
 * Six fixed palettes meant the sky snapped from one to the next — the same
 * colours all afternoon, then a jump. Easing between them keeps every phase's
 * identity while letting the shade drift the whole time, so late morning is
 * recognisably morning but not the same morning as nine o'clock.
 */
export function getSkyPalette(date = new Date()): SkyPalette {
  const hour = date.getHours() + date.getMinutes() / 60;
  const phase = getSkyPhase(date);

  const index = PHASE_START.findIndex(([name]) => name === phase);
  const [, start] = PHASE_START[index];
  const nextIndex = (index + 1) % PHASE_START.length;
  const [nextName, nextStart] = PHASE_START[nextIndex];

  // Night wraps past midnight, so its span is measured the long way round.
  const span = (nextStart - start + 24) % 24;
  const elapsed = (hour - start + 24) % 24;
  const linear = span > 0 ? Math.min(Math.max(elapsed / span, 0), 1) : 0;

  // Smoothstep: the drift is imperceptible mid-phase and gathers towards the
  // handover, rather than crawling at a constant rate all day.
  const t = linear * linear * (3 - 2 * linear);

  const from = SKY[phase];
  const to = SKY[nextName];

  const colors = from.colors.map((color, i) =>
    mixHex(color, to.colors[Math.min(i, to.colors.length - 1)], t)
  ) as unknown as readonly [string, string, ...string[]];

  return {
    ...from,
    colors,
    glow: mixHex(from.glow, to.glow, t),
    cloud: mixHex(from.cloud, to.cloud, t),
    cloudOpacity: from.cloudOpacity + (to.cloudOpacity - from.cloudOpacity) * t,
    topRGB: mixTriplet(from.topRGB, to.topRGB, t),
    bottomRGB: mixTriplet(from.bottomRGB, to.bottomRGB, t),
    // Snapped rather than blended: a half-mixed text colour is muddy on both
    // skies instead of readable on either.
    glowPosition: t < 0.5 ? from.glowPosition : to.glowPosition,
    text: t < 0.5 ? from.text : to.text,
    subtext: t < 0.5 ? from.subtext : to.subtext,
  };
}

/**
 * Weather is set by whoever draws the sky, not fetched.
 *
 * This used to look the weather up: the device's IP went to a geolocation
 * service for coarse coordinates, and those went to a forecast API. It was the
 * only thing in the app that ever left the device, and it made an app that
 * holds nothing but your own documents into one that has a third party to name
 * in its privacy policy — for the colour of a background. The sky still knows
 * what time it is, which it works out on the device from the clock, and it can
 * still be told it is raining by anything that knows.
 */
