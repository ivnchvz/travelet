import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { ContinuousForm, declarationListing } from './ContinuousForm';
import { SHADOW_SURFACE } from './motion';
import { ObjectSpec } from './theme';

interface DeclareObjectProps {
  items: string[];
  onChangeItems: (items: string[]) => void;
  /** Fires whenever the form opens or shuts, however it was triggered. */
  onOpenChange?: (open: boolean) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One corner radius for the sheet and its interior. */
const SHEET_RADIUS = 18;

const DECLARE_SPEC: ObjectSpec = {
  hinge: 'top',
  hingeAnchor: 'edge',
  openDeg: 150,
  widthPct: 0.88,
  aspect: 0.74,
  radius: 6,
  coverBack: '#f1efe6',
  open: { widthPct: 0.88, aspect: 0.76 },
  interior: {
    bg: '#fdfcf7',
    text: '#1f2937',
    accent: '#dc2626',
    gradient: ['#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#500a0a'],
    line: '#e5e1d8',
    decor: 'ruled',
  },
};

/**
 * The customs declaration: a printout you tear open.
 *
 * Closed, it is a sheet of continuous stationery off a tractor-feed printer —
 * an actual cover, where before the page was simply held out of focus behind
 * frosted glass. A blur says "there is something here you cannot read yet",
 * which is a statement about the interface; a printed form that reports its
 * status as SEALED says the same thing as an object, and can carry the count
 * and the instruction to open it besides.
 */
export function DeclareObject({ items, onChangeItems, onOpenChange }: DeclareObjectProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const addItem = () => {
    if (!input.trim()) return;
    onChangeItems([...items, input.trim()]);
    setInput('');
  };

  const interior = (
    <View style={styles.interior}>
      <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#fdfcf7', opacity: 0.75 }]}
        pointerEvents="none"
      />
      {/* tapping the paper itself folds the form back up */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />

      <View style={styles.header} pointerEvents="none">
        <Text style={styles.title}>Things to Declare</Text>
        <Text style={styles.subtitle}>Items to declare at customs.</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Write an item on the form..."
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={addItem}
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* clears the seal, so the last item never sits under it */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 52 }}>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>Nothing to declare… yet.</Text>
        ) : (
          items.map((item, idx) => (
            <Animated.View
              key={`${item}-${idx}`}
              entering={FadeInDown.springify().delay(60 + idx * 50)}
              style={styles.itemRow}
            >
              <View style={styles.checkbox}>
                <Ionicons name="checkmark" size={11} color="#374151" />
              </View>
              <Text style={styles.itemText} numberOfLines={1}>
                {item}
              </Text>
              <TouchableOpacity
                onPress={() => onChangeItems(items.filter((_, i) => i !== idx))}
                hitSlop={8}
              >
                <Ionicons name="close" size={15} color="rgba(255,59,48,0.8)" />
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* The same print the categories close on. Tapping the paper still works,
          but nothing on screen said so — the seal is the affordance and the
          instruction at once. */}
      <TouchableOpacity
        style={styles.closeSeal}
        onPress={() => setOpen(false)}
        activeOpacity={0.6}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel="Close the declaration"
      >
        <Ionicons name="finger-print" size={20} color={DECLARE_SPEC.interior.accent} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.frame}>
      <View style={styles.sheet}>
        {interior}

        {!open && (
          <AnimatedPressable
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(200)}
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Show what you're declaring"
          >
            <ContinuousForm lines={declarationListing(items.length)} />
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: `${DECLARE_SPEC.open.widthPct * 100}%`,
    aspectRatio: DECLARE_SPEC.open.aspect,
    // Matches the interior exactly. They were 10 and 18, so the cover clipped to
    // one curve while the page drew another and the corners disagreed.
    borderRadius: SHEET_RADIUS,
    overflow: 'hidden',
    ...SHADOW_SURFACE,
  },
  interior: {
    flex: 1,
    borderRadius: SHEET_RADIUS,
    borderWidth: 1,
    borderColor: '#e5e1d8',
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#1e293b',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#1c1c1e',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#8e8e93',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.35)',
    paddingVertical: 7,
    fontSize: 15,
    color: '#1c1c1e',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: 'rgba(60,60,67,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    flex: 1,
    fontSize: 15,
    color: '#1c1c1e',
  },
  closeSeal: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
