import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface Visit {
  id: string;
  /** ISO 3166-1 alpha-3, keyed to `COUNTRIES`. */
  country: string;
  /** ISO date of arrival. */
  date: string;
  /** Free text, so a trip can be remembered by more than a country. */
  note?: string;
}

const WEB_KEY = 'travelet-visits';

/**
 * The places someone has been, kept alongside their documents.
 *
 * Stored in its own file rather than inside `categories.json`: visits outlive
 * the paperwork for a trip, and a passport that gets deleted shouldn't take the
 * record of the journey with it.
 */
class VisitService {
  private isWeb = Platform.OS === 'web';
  private file = `${FileSystem.documentDirectory}PDFs/visits.json`;

  async all(): Promise<Visit[]> {
    try {
      if (this.isWeb) {
        if (typeof localStorage === 'undefined') return [];
        const stored = localStorage.getItem(WEB_KEY);
        return stored ? JSON.parse(stored) : [];
      }

      const exists = await FileSystem.getInfoAsync(this.file);
      if (!exists.exists) return [];

      const content = await FileSystem.readAsStringAsync(this.file, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading visits:', error);
      return [];
    }
  }

  private async save(visits: Visit[]): Promise<void> {
    if (this.isWeb) {
      localStorage.setItem(WEB_KEY, JSON.stringify(visits));
      return;
    }
    await FileSystem.writeAsStringAsync(this.file, JSON.stringify(visits, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  async add(country: string, date: string, note?: string): Promise<Visit> {
    const visits = await this.all();
    const visit: Visit = { id: Date.now().toString(), country, date, note };

    // Newest first, which is the order the book pages through them.
    visits.unshift(visit);
    await this.save(visits);
    return visit;
  }

  async remove(id: string): Promise<void> {
    const visits = await this.all();
    await this.save(visits.filter((visit) => visit.id !== id));
  }

  /** Distinct countries, for the "23 countries" style summary. */
  async countryCount(): Promise<number> {
    const visits = await this.all();
    return new Set(visits.map((visit) => visit.country)).size;
  }
}

export default new VisitService();
