import * as FileSystem from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const FLAG_FILE = `${FileSystem.documentDirectory}onboarding-seen`;
const WEB_KEY = 'travelet-onboarding-seen';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' && localStorage.getItem(WEB_KEY) === 'true';
    }
    const info = await FileSystem.getInfoAsync(FLAG_FILE);
    return info.exists;
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(WEB_KEY, 'true');
      return;
    }
    await FileSystem.writeAsStringAsync(FLAG_FILE, '1');
  } catch (error) {
    console.error('Error persisting onboarding flag:', error);
  }
}

export interface OnboardingProfile {
  /** ISO 3166-1 alpha-3 of the country the traveller holds a passport from. */
  country?: string;
  /**
   * Who the documents on this shelf belong to.
   *
   * Every import asks whose a document is and offers the travellers it already
   * knows as chips — which on a new shelf is nobody, so the first several
   * imports each need a name typed out. Asked once here instead.
   */
  travelers?: string[];
}

const PROFILE_FILE = `${FileSystem.documentDirectory}onboarding-profile.json`;
const WEB_PROFILE_KEY = 'travelet-onboarding-profile';

export async function saveOnboardingProfile(profile: OnboardingProfile): Promise<void> {
  setHomeCountry(profile.country);
  setKnownTravelers(profile.travelers);
  try {
    const json = JSON.stringify(profile);
    if (Platform.OS === 'web') {
      localStorage.setItem(WEB_PROFILE_KEY, json);
      return;
    }
    await FileSystem.writeAsStringAsync(PROFILE_FILE, json);
  } catch (error) {
    console.error('Error persisting onboarding profile:', error);
  }
}

export async function loadOnboardingProfile(): Promise<OnboardingProfile | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(WEB_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    const info = await FileSystem.getInfoAsync(PROFILE_FILE);
    if (!info.exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(PROFILE_FILE));
  } catch {
    return null;
  }
}

/**
 * The traveller's own country, shared with whatever draws a passport.
 *
 * The covers are leaves — `CategoryObject` picks one from a lookup by type and
 * hands it only a name and a count — so threading the country down as a prop
 * would mean widening every cover's signature for the benefit of one. A store
 * read straight from the leaf keeps that seam where it is. It hydrates from
 * disk on first subscribe and is written through by `saveOnboardingProfile`, so
 * the passport re-marks itself the moment onboarding finishes.
 */
let homeCountry: string | undefined;
let hydrating = false;
const listeners = new Set<() => void>();

export function setHomeCountry(code: string | undefined): void {
  if (code === homeCountry) return;
  homeCountry = code;
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!hydrating) {
    hydrating = true;
    loadOnboardingProfile().then((profile) => {
      setHomeCountry(profile?.country);
      setKnownTravelers(profile?.travelers);
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

const getHomeCountry = () => homeCountry;

export function useHomeCountry(): string | undefined {
  return useSyncExternalStore(subscribe, getHomeCountry, getHomeCountry);
}

/**
 * The travellers named during onboarding, before any document exists.
 *
 * Rides the same store as the country for the same reason: the modal that
 * needs them is opened from a category, which knows only its own documents.
 * The identity of the array matters — `useSyncExternalStore` compares by
 * reference — so an unchanged list has to keep returning the same one or every
 * subscriber re-renders on each read.
 */
let knownTravelers: string[] = [];

export function setKnownTravelers(names: string[] | undefined): void {
  const next = (names ?? []).map((name) => name.trim()).filter(Boolean);
  if (next.length === knownTravelers.length && next.every((n, i) => n === knownTravelers[i])) {
    return;
  }
  knownTravelers = next;
  listeners.forEach((notify) => notify());
}

const getKnownTravelers = () => knownTravelers;

export function useKnownTravelers(): string[] {
  return useSyncExternalStore(subscribe, getKnownTravelers, getKnownTravelers);
}
