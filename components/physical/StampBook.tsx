import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { COUNTRIES, Country, findCountry, searchCountries } from '../../services/Countries';
import VisitService, { Visit } from '../../services/VisitService';
import { Stamp } from './Stamp';
import { Texture } from './Texture';

interface StampBookProps {
  visible: boolean;
  onClose: () => void;
  /** Paper the stamps are pressed onto. */
  paper?: string;
}

/**
 * The places someone has been, as a page of stamps.
 *
 * Visits are entered by hand rather than inferred from documents: a boarding
 * pass proves a flight was booked, not that the trip happened, and the text
 * extraction it would rely on already fails on some PDFs. Being asked is both
 * more accurate and less surprising.
 */
export function StampBook({ visible, onClose, paper = '#f6efdf' }: StampBookProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [picking, setPicking] = useState(false);
  const [lifted, setLifted] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    VisitService.all().then(setVisits).catch(() => setVisits([]));
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const addVisit = async (country: Country) => {
    try {
      await VisitService.add(country.code, new Date().toISOString());
      setPicking(false);
      setQuery('');
      load();
    } catch {
      // nothing worth interrupting the user for
    }
  };

  /** Tapping a stamp offers to lift it — long-press alone was undiscoverable. */
  const confirmRemove = (visit: Visit) => {
    const country = findCountry(visit.country);
    Alert.alert(
      country?.name ?? 'This place',
      'Remove this stamp from your page?',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeVisit(visit.id) },
      ]
    );
  };

  const removeVisit = async (id: string) => {
    await VisitService.remove(id);
    load();
  };

  const countries = new Set(visits.map((visit) => visit.country)).size;
  const results = searchCountries(query);

  // Pitched to roughly clear each other, with enough jitter that some pairs
  // will still touch. Overlap isn't the goal, it just isn't a problem.
  const rows = Math.ceil(visits.length / 2);
  const pageHeight = rows * ROW_PITCH + STAMP_SIZE + PAGE_INSET * 2;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.page, { backgroundColor: paper }]}>
        <Texture variant="paper" opacity={0.6} />

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Places</Text>
            <Text style={styles.subtitle}>
              {countries === 0
                ? 'No stamps yet'
                : `${countries} ${countries === 1 ? 'country' : 'countries'} · ${visits.length} ${
                    visits.length === 1 ? 'visit' : 'visits'
                  }`}
            </Text>
          </View>
          <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color="#5a4632" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.sheet,
            visits.length > 0 && { height: pageHeight },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {visits.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="earth-outline" size={40} color="rgba(90,70,50,0.35)" />
              <Text style={styles.emptyText}>
                Add somewhere you&apos;ve been and it gets stamped here.
              </Text>
            </View>
          ) : (
            visits.map((visit, index) => {
              const country = findCountry(visit.country);
              if (!country) return null;

              const place = scatter(visit.id, index);

              return (
                <Animated.View
                  key={visit.id}
                  entering={ZoomIn.springify().damping(14).delay(Math.min(index, 8) * 60)}
                  style={[
                    styles.pressed,
                    {
                      left: place.left,
                      top: place.top,
                      // Later stamps sit over earlier ones, but whichever you
                      // reach for comes to the front — so a partly covered
                      // stamp is never awkward to get at.
                      zIndex: lifted === visit.id ? 999 : index + 1,
                    },
                  ]}
                >
                  <Pressable
                    onPressIn={() => setLifted(visit.id)}
                    onPress={() => confirmRemove(visit)}
                    onLongPress={() => confirmRemove(visit)}
                    accessibilityRole="button"
                    accessibilityLabel={`${findCountry(visit.country)?.name ?? visit.country} stamp`}
                  >
                    <Stamp country={country} visit={visit} size={STAMP_SIZE} angle={place.angle} />
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </ScrollView>

        {visits.length > 0 && (
          <Text style={styles.hint}>Tap a stamp to remove it</Text>
        )}

        <TouchableOpacity style={styles.add} onPress={() => setPicking(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addText}>Add a place</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <BlurView intensity={90} tint="light" style={styles.picker}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Where have you been?</Text>
            <TouchableOpacity onPress={() => setPicking(false)} hitSlop={10}>
              <Ionicons name="close" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search countries"
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />

          <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
            {results.map((country, index) => (
              <Animated.View key={country.code} entering={FadeInUp.delay(Math.min(index, 10) * 20)}>
                <TouchableOpacity
                  style={styles.result}
                  onPress={() => addVisit(country)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.swatch, { backgroundColor: country.ink }]}>
                    <Ionicons name={country.motif} size={14} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{country.name}</Text>
                    <Text style={styles.resultEntry}>{country.entry}</Text>
                  </View>
                  <Text style={styles.resultCode}>{country.code}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
            {results.length === 0 && (
              <Text style={styles.noResults}>
                Nothing matching that yet — {COUNTRIES.length} countries so far.
              </Text>
            )}
          </ScrollView>
        </BlurView>
      </Modal>
    </Modal>
  );
}

const STAMP_SIZE = 132;
/** Enough to clear a neighbour, close enough that jitter can still touch one. */
const COLUMN_PITCH = STAMP_SIZE * 0.98;
const ROW_PITCH = STAMP_SIZE * 0.92;
/** Covers the jitter range plus the extra a rotated corner sweeps out. */
const PAGE_INSET = 22;

/**
 * A repeatable position for a stamp, derived from its own id.
 *
 * Deterministic rather than random: a stamp has to land in the same place every
 * time the page is opened, or the page would reshuffle itself on every visit.
 */
function scatter(id: string, index: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 100000;

  const column = index % 2;
  const row = Math.floor(index / 2);
  const jitterX = (hash % 24) - 12;
  const jitterY = ((hash >> 5) % 22) - 11;
  const angle = ((hash >> 9) % 24) - 12;

  return {
    // Offset by the jitter's own range, so a negative nudge can't push a stamp
    // outside the page and get it clipped.
    left: PAGE_INSET + column * COLUMN_PITCH + jitterX,
    top: PAGE_INSET + row * ROW_PITCH + jitterY,
    angle,
  };
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 68,
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    color: '#5a4632',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: 'rgba(90,70,50,0.7)',
    marginTop: 2,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    alignSelf: 'center',
    width: STAMP_SIZE * 2 + PAGE_INSET * 2 + 8,
    paddingTop: 20,
    paddingBottom: 140,
  },
  pressed: {
    position: 'absolute',
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 90,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: 'rgba(90,70,50,0.7)',
    textAlign: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 104,
    alignSelf: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: 'rgba(90,70,50,0.55)',
  },
  add: {
    position: 'absolute',
    bottom: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: '#5a4632',
  },
  addText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },

  picker: { flex: 1, paddingTop: 62 },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    color: '#1e293b',
  },
  search: {
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#1e293b',
  },
  results: { padding: 20, paddingBottom: 60 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1e293b',
  },
  resultEntry: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#64748b',
  },
  resultCode: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#94a3b8',
    letterSpacing: 1,
  },
  noResults: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingTop: 30,
  },
});
