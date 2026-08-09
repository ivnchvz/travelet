import { StampShape } from '@/components/physical/InkedStamp';
import { Ionicons } from '@expo/vector-icons';

export interface Country {
  /** ISO 3166-1 alpha-3, printed on the stamp. */
  code: string;
  name: string;
  /** A city that reads as the point of entry. */
  entry: string;
  /** The entry city's position, used to centre the country on the passport's dot map. */
  lon: number;
  lat: number;
  /** Rough extent as [west, south, east, north]; the dots inside it are lit. */
  box: [number, number, number, number];
  /**
   * The cover's stacked title, in the country's own language(s) and then in
   * English — the form a passport's own wordmark takes. Nothing else on the
   * cover names an authority: this is a keepsake, and a cover carrying a real
   * state's emblem and issuing department would be a picture of a document
   * rather than a picture of a memento.
   */
  titles: string[];
  /** Ink colour. Drawn from the country's own palette, not its flag exactly. */
  ink: string;
  motif: keyof typeof Ionicons.glyphMap;
  /** Outline, so neighbours on the page don't all look alike. */
  shape: StampShape;
}

/**
 * The fifty most-visited countries, with a look for each.
 *
 * These are deliberately *souvenir* stamps, not reproductions of real
 * immigration marks: the app is a keepsake, and a convincing copy of an
 * official entry stamp would be a tool for inventing a travel history. The ink
 * colour, motif and border are chosen to evoke a place rather than to imitate
 * any particular government's stamp.
 */
export const COUNTRIES: Country[] = [
  { code: 'FRA', name: 'France', entry: 'Paris', lon: 2.35, lat: 48.85, box: [-5, 42, 8, 51], titles: ['Passeport français', 'French passport'], ink: '#1f3a93', motif: 'wine-outline', shape: 'arch' },
  { code: 'ESP', name: 'Spain', entry: 'Madrid', lon: -3.7, lat: 40.42, box: [-9.3, 36, 3.3, 43.8], titles: ['Pasaporte español', 'Spanish passport'], ink: '#c0392b', motif: 'sunny-outline', shape: 'oval' },
  { code: 'USA', name: 'United States', entry: 'New York', lon: -74.01, lat: 40.71, box: [-125, 25, -67, 49], titles: ['Passport', 'United States of America'], ink: '#1b3a6b', motif: 'flag-outline', shape: 'rect' },
  { code: 'ITA', name: 'Italy', entry: 'Rome', lon: 12.5, lat: 41.9, box: [6.6, 36.6, 18.5, 47.1], titles: ['Passaporto italiano', 'Italian passport'], ink: '#1e7a4a', motif: 'pizza-outline', shape: 'round' },
  { code: 'TUR', name: 'Türkiye', entry: 'Istanbul', lon: 28.98, lat: 41.01, box: [26, 36, 45, 42], titles: ['Türkiye pasaportu', 'Turkish passport'], ink: '#b32d3a', motif: 'moon-outline', shape: 'hex' },
  { code: 'MEX', name: 'Mexico', entry: 'Mexico City', lon: -99.13, lat: 19.43, box: [-117, 14.5, -86.7, 32.7], titles: ['Pasaporte mexicano', 'Mexican passport'], ink: '#137a52', motif: 'sunny-outline', shape: 'octagon' },
  { code: 'THA', name: 'Thailand', entry: 'Bangkok', lon: 100.5, lat: 13.75, box: [97.3, 5.6, 105.6, 20.5], titles: ['หนังสือเดินทางไทย', 'Thai passport'], ink: '#8e44ad', motif: 'boat-outline', shape: 'capsule' },
  { code: 'DEU', name: 'Germany', entry: 'Berlin', lon: 13.4, lat: 52.52, box: [5.9, 47.3, 15, 55], titles: ['Deutscher Reisepass', 'German passport'], ink: '#3d3d3d', motif: 'beer-outline', shape: 'shield' },
  { code: 'GBR', name: 'United Kingdom', entry: 'London', lon: -0.13, lat: 51.51, box: [-8, 50, 1.8, 58.7], titles: ['Passport', 'United Kingdom'], ink: '#1d3557', motif: 'umbrella-outline', shape: 'arch' },
  { code: 'JPN', name: 'Japan', entry: 'Tokyo', lon: 139.69, lat: 35.69, box: [129, 31, 146, 45.5], titles: ['日本国旅券', 'Japanese passport'], ink: '#c62828', motif: 'flower-outline', shape: 'oval' },
  { code: 'AUT', name: 'Austria', entry: 'Vienna', lon: 16.37, lat: 48.21, box: [9.5, 46.4, 17.2, 49], titles: ['Österreichischer Reisepass', 'Austrian passport'], ink: '#8e2f3f', motif: 'musical-notes-outline', shape: 'rect' },
  { code: 'GRC', name: 'Greece', entry: 'Athens', lon: 23.73, lat: 37.98, box: [19.4, 34.8, 28.2, 41.7], titles: ['Ελληνικό διαβατήριο', 'Greek passport'], ink: '#1565c0', motif: 'boat-outline', shape: 'round' },
  { code: 'PRT', name: 'Portugal', entry: 'Lisbon', lon: -9.14, lat: 38.72, box: [-9.5, 37, -6.2, 42.2], titles: ['Passaporte português', 'Portuguese passport'], ink: '#1e7a4a', motif: 'fish-outline', shape: 'hex' },
  { code: 'CAN', name: 'Canada', entry: 'Toronto', lon: -79.38, lat: 43.65, box: [-141, 42, -52, 70], titles: ['Passeport canadien', 'Canadian passport'], ink: '#b71c1c', motif: 'leaf-outline', shape: 'octagon' },
  { code: 'POL', name: 'Poland', entry: 'Warsaw', lon: 21.01, lat: 52.23, box: [14.1, 49, 24.2, 54.8], titles: ['Paszport polski', 'Polish passport'], ink: '#9b2335', motif: 'business-outline', shape: 'capsule' },
  { code: 'NLD', name: 'Netherlands', entry: 'Amsterdam', lon: 4.9, lat: 52.37, box: [3.4, 50.8, 7.2, 53.5], titles: ['Nederlands paspoort', 'Netherlands passport'], ink: '#e07b1a', motif: 'bicycle-outline', shape: 'shield' },
  { code: 'CHN', name: 'China', entry: 'Beijing', lon: 116.41, lat: 39.9, box: [73.5, 18, 135, 53.5], titles: ['中华人民共和国护照', 'Chinese passport'], ink: '#b8232f', motif: 'business-outline', shape: 'arch' },
  { code: 'HKG', name: 'Hong Kong', entry: 'Hong Kong', lon: 114.17, lat: 22.32, box: [113.8, 22.1, 114.4, 22.6], titles: ['香港特別行政區護照', 'Hong Kong passport'], ink: '#a4243b', motif: 'boat-outline', shape: 'oval' },
  { code: 'MYS', name: 'Malaysia', entry: 'Kuala Lumpur', lon: 101.69, lat: 3.14, box: [99.6, 1, 119.3, 7.4], titles: ['Pasport Malaysia', 'Malaysian passport'], ink: '#12507a', motif: 'business-outline', shape: 'rect' },
  { code: 'RUS', name: 'Russia', entry: 'Moscow', lon: 37.62, lat: 55.75, box: [19, 41, 180, 77], titles: ['Паспорт Российской Федерации', 'Russian passport'], ink: '#2c3e70', motif: 'snow-outline', shape: 'round' },
  { code: 'ARE', name: 'United Arab Emirates', entry: 'Dubai', lon: 55.27, lat: 25.2, box: [51, 22.6, 56.4, 26.1], titles: ['جواز سفر إماراتي', 'Emirati passport'], ink: '#0f6b4f', motif: 'business-outline', shape: 'hex' },
  { code: 'KOR', name: 'South Korea', entry: 'Seoul', lon: 126.98, lat: 37.57, box: [126, 33, 129.6, 38.6], titles: ['대한민국 여권', 'Korean passport'], ink: '#1c4e80', motif: 'flower-outline', shape: 'octagon' },
  { code: 'HUN', name: 'Hungary', entry: 'Budapest', lon: 19.04, lat: 47.5, box: [16.1, 45.7, 22.9, 48.6], titles: ['Magyar útlevél', 'Hungarian passport'], ink: '#1e7a4a', motif: 'water-outline', shape: 'capsule' },
  { code: 'SAU', name: 'Saudi Arabia', entry: 'Riyadh', lon: 46.68, lat: 24.71, box: [34.5, 16, 55.7, 32.2], titles: ['جواز سفر سعودي', 'Saudi passport'], ink: '#0f6b3f', motif: 'moon-outline', shape: 'shield' },
  { code: 'CHE', name: 'Switzerland', entry: 'Zurich', lon: 8.54, lat: 47.38, box: [5.9, 45.8, 10.5, 47.8], titles: ['Schweizer Pass', 'Passeport suisse', 'Passaporto svizzero', 'Passaport svizzer', 'Swiss passport'], ink: '#c0392b', motif: 'snow-outline', shape: 'arch' },
  { code: 'VNM', name: 'Vietnam', entry: 'Hanoi', lon: 105.83, lat: 21.03, box: [102, 8.5, 109.5, 23.4], titles: ['Hộ chiếu Việt Nam', 'Vietnamese passport'], ink: '#c8102e', motif: 'leaf-outline', shape: 'oval' },
  { code: 'IND', name: 'India', entry: 'Delhi', lon: 77.21, lat: 28.61, box: [68, 8, 97.4, 35.5], titles: ['भारतीय पासपोर्ट', 'Indian passport'], ink: '#d1701a', motif: 'flower-outline', shape: 'rect' },
  { code: 'CZE', name: 'Czechia', entry: 'Prague', lon: 14.42, lat: 50.08, box: [12.1, 48.5, 18.9, 51.1], titles: ['Cestovní pas', 'Czech passport'], ink: '#2b4c8c', motif: 'business-outline', shape: 'round' },
  { code: 'IDN', name: 'Indonesia', entry: 'Bali', lon: 115.19, lat: -8.41, box: [95, -11, 141, 6], titles: ['Paspor Indonesia', 'Indonesian passport'], ink: '#c0392b', motif: 'leaf-outline', shape: 'hex' },
  { code: 'DNK', name: 'Denmark', entry: 'Copenhagen', lon: 12.57, lat: 55.68, box: [8, 54.5, 12.7, 57.8], titles: ['Dansk pas', 'Danish passport'], ink: '#a4243b', motif: 'bicycle-outline', shape: 'octagon' },
  { code: 'SWE', name: 'Sweden', entry: 'Stockholm', lon: 18.07, lat: 59.33, box: [11, 55.3, 24.2, 69.1], titles: ['Svenskt pass', 'Swedish passport'], ink: '#1c5b9c', motif: 'snow-outline', shape: 'capsule' },
  { code: 'NOR', name: 'Norway', entry: 'Oslo', lon: 10.75, lat: 59.91, box: [4.5, 58, 31, 71.2], titles: ['Norsk pass', 'Norwegian passport'], ink: '#1d3f7a', motif: 'snow-outline', shape: 'shield' },
  { code: 'IRL', name: 'Ireland', entry: 'Dublin', lon: -6.26, lat: 53.35, box: [-10.5, 51.4, -6, 55.4], titles: ['Pas Éireannach', 'Irish passport'], ink: '#1e7a4a', motif: 'leaf-outline', shape: 'arch' },
  { code: 'BEL', name: 'Belgium', entry: 'Brussels', lon: 4.35, lat: 50.85, box: [2.5, 49.5, 6.4, 51.5], titles: ['Belgisch paspoort', 'Passeport belge', 'Belgischer Reisepass', 'Belgian passport'], ink: '#8a6d1f', motif: 'beer-outline', shape: 'oval' },
  { code: 'SGP', name: 'Singapore', entry: 'Singapore', lon: 103.82, lat: 1.35, box: [103.6, 1.2, 104.1, 1.5], titles: ['Pasport Singapura', 'Singapore passport'], ink: '#b8232f', motif: 'business-outline', shape: 'rect' },
  { code: 'AUS', name: 'Australia', entry: 'Sydney', lon: 151.21, lat: -33.87, box: [113, -39, 154, -10.7], titles: ['Passport', 'Australia'], ink: '#12507a', motif: 'sunny-outline', shape: 'round' },
  { code: 'BRA', name: 'Brazil', entry: 'Rio de Janeiro', lon: -43.17, lat: -22.91, box: [-74, -33.7, -34.8, 5.3], titles: ['Passaporte brasileiro', 'Brazilian passport'], ink: '#1e7a4a', motif: 'sunny-outline', shape: 'hex' },
  { code: 'ARG', name: 'Argentina', entry: 'Buenos Aires', lon: -58.38, lat: -34.6, box: [-73.6, -55, -53.6, -21.8], titles: ['Pasaporte argentino', 'Argentine passport'], ink: '#3d8fc4', motif: 'sunny-outline', shape: 'octagon' },
  { code: 'ZAF', name: 'South Africa', entry: 'Cape Town', lon: 18.42, lat: -33.92, box: [16.5, -34.9, 32.9, -22.1], titles: ['Suid-Afrikaanse paspoort', 'South African passport'], ink: '#1a7a5e', motif: 'paw-outline', shape: 'capsule' },
  { code: 'MAR', name: 'Morocco', entry: 'Marrakesh', lon: -7.98, lat: 31.63, box: [-13, 27.7, -1, 35.9], titles: ['جواز السفر المغربي', 'Moroccan passport'], ink: '#a4243b', motif: 'moon-outline', shape: 'shield' },
  { code: 'EGY', name: 'Egypt', entry: 'Cairo', lon: 31.24, lat: 30.04, box: [24.7, 22, 36.9, 31.7], titles: ['جواز سفر مصري', 'Egyptian passport'], ink: '#b58a2b', motif: 'triangle-outline', shape: 'arch' },
  { code: 'HRV', name: 'Croatia', entry: 'Split', lon: 16.44, lat: 43.51, box: [13.5, 42.4, 19.4, 46.5], titles: ['Hrvatska putovnica', 'Croatian passport'], ink: '#1565c0', motif: 'boat-outline', shape: 'oval' },
  { code: 'ROU', name: 'Romania', entry: 'Bucharest', lon: 26.1, lat: 44.43, box: [20.3, 43.6, 29.7, 48.3], titles: ['Pașaport românesc', 'Romanian passport'], ink: '#1d4f91', motif: 'business-outline', shape: 'rect' },
  { code: 'UKR', name: 'Ukraine', entry: 'Kyiv', lon: 30.52, lat: 50.45, box: [22.1, 44.4, 40.2, 52.4], titles: ['Паспорт громадянина України', 'Ukrainian passport'], ink: '#1c6fb4', motif: 'flower-outline', shape: 'round' },
  { code: 'PER', name: 'Peru', entry: 'Lima', lon: -77.04, lat: -12.05, box: [-81.3, -18.4, -68.7, -0.1], titles: ['Pasaporte peruano', 'Peruvian passport'], ink: '#a4243b', motif: 'triangle-outline', shape: 'hex' },
  { code: 'CHL', name: 'Chile', entry: 'Santiago', lon: -70.65, lat: -33.46, box: [-75.6, -55.9, -66.4, -17.5], titles: ['Pasaporte chileno', 'Chilean passport'], ink: '#1d3f7a', motif: 'snow-outline', shape: 'octagon' },
  { code: 'COL', name: 'Colombia', entry: 'Bogotá', lon: -74.07, lat: 4.71, box: [-79, -4.2, -66.9, 12.5], titles: ['Pasaporte colombiano', 'Colombian passport'], ink: '#c8951a', motif: 'cafe-outline', shape: 'capsule' },
  { code: 'NZL', name: 'New Zealand', entry: 'Auckland', lon: 174.76, lat: -36.85, box: [166, -47.3, 178.6, -34.4], titles: ['Uruwhenua Aotearoa', 'New Zealand passport'], ink: '#12507a', motif: 'leaf-outline', shape: 'shield' },
  { code: 'ISL', name: 'Iceland', entry: 'Reykjavík', lon: -21.94, lat: 64.15, box: [-24.5, 63.4, -13.5, 66.6], titles: ['Íslenskt vegabréf', 'Icelandic passport'], ink: '#2c6e8f', motif: 'snow-outline', shape: 'arch' },
  { code: 'PHL', name: 'Philippines', entry: 'Manila', lon: 120.98, lat: 14.6, box: [116.9, 4.6, 126.6, 19.6], titles: ['Pasaporte ng Pilipinas', 'Philippine passport'], ink: '#1c5b9c', motif: 'sunny-outline', shape: 'oval' },
];

export const COUNTRIES_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((country) => [country.code, country])
);

export function findCountry(code: string): Country | undefined {
  return COUNTRIES_BY_CODE[code];
}

export function searchCountries(query: string): Country[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return COUNTRIES;
  return COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(needle) ||
      country.code.toLowerCase().includes(needle) ||
      country.entry.toLowerCase().includes(needle)
  );
}
