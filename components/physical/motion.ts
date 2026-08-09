import { ViewStyle } from 'react-native';

/**
 * One motion vocabulary for the whole app — every interaction picks from
 * these four curves so everything decelerates the same way.
 */

/** Finger-down feedback: immediate, tight. */
export const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

/** Things returning to rest after a drag. */
export const SETTLE_SPRING = { damping: 18, stiffness: 170, mass: 0.7 };

/**
 * Objects opening/closing. Clamped at the target: a hinge that has reached
 * the table must not bounce off it — overshoot here reads as flicker
 * (and would briefly re-show the cover after its endpaper handoff).
 */
export const OPEN_SPRING = { damping: 19, stiffness: 135, mass: 0.95, overshootClamping: true };
export const CLOSE_SPRING = { damping: 23, stiffness: 200, mass: 0.85, overshootClamping: true };

/** Soft, large-radius shadows — depth without weight. */
export const SHADOW_OBJECT: ViewStyle = {
  shadowColor: '#1e293b',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.18,
  shadowRadius: 18,
  elevation: 10,
};

export const SHADOW_SURFACE: ViewStyle = {
  shadowColor: '#1e293b',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 16,
  elevation: 8,
};

export const SHADOW_SHEET: ViewStyle = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.16,
  shadowRadius: 12,
  elevation: 6,
};

/** iOS-style caption used for in-object hints and indicators. */
export const CAPTION = {
  fontSize: 11,
  fontWeight: '500' as const,
  letterSpacing: 0.2,
  color: 'rgba(60,60,67,0.6)',
};
