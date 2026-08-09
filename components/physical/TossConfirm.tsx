import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Texture } from './Texture';

interface TossConfirmProps {
  visible: boolean;
  /** The document about to go, named so it is obvious which one is in the hand. */
  name: string;
  onKeep: () => void;
  onThrow: () => void;
}

/**
 * The last word before a document is gone.
 *
 * This was a system alert, which is the one thing in the app that looked like
 * every other app: a grey slab in the middle of a wallet full of paper. The
 * gesture that leads here is physical — you pull a card out of the fan and let
 * go of it — so the question is asked in the same terms, with the card itself
 * held up mid-air over the answer.
 *
 * Built in the language the other modals already speak: dark blur behind,
 * light glass panel, one destructive action and one way out of it.
 */
export function TossConfirm({ visible, name, onKeep, onThrow }: TossConfirmProps) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onKeep}>
      <BlurView intensity={50} tint="dark" style={styles.backdrop}>
        {/* the way out for anyone who reached here by accident */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onKeep} />

        <View style={styles.centre} pointerEvents="box-none">
          <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.panelWrap}>
            <BlurView intensity={85} tint="light" style={styles.panel}>
              <View style={styles.panelTint} pointerEvents="none" />
              <View style={styles.glassEdge} pointerEvents="none" />

              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="trash-outline" size={17} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Throw it out?</Text>
                  <Text style={styles.subtitle}>This one doesn&apos;t come back.</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* The card, held at the angle it was let go at. */}
              <Animated.View entering={FadeInUp.springify().delay(70)} style={styles.slipWrap}>
                <View style={styles.slip}>
                  <Texture variant="paper" opacity={0.6} />
                  <Text style={styles.slipName} numberOfLines={2}>
                    {name}
                  </Text>
                </View>
              </Animated.View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.keep]}
                  onPress={onKeep}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                >
                  <Text style={styles.keepText}>Keep it</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.throw]}
                  onPress={onThrow}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.throwText}>Throw out</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panelWrap: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  panel: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 20,
  },
  panelTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  glassEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3b30',
    shadowColor: '#7f1d1d',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15,23,42,0.08)',
    marginVertical: 14,
  },
  slipWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  /** A card at rest would read as filed; this one is still in the air. */
  slip: {
    width: 168,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f6f1e7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(67,57,44,0.28)',
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  slipName: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: '#2b2318',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keep: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  keepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  throw: {
    backgroundColor: '#ff3b30',
    shadowColor: '#7f1d1d',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  throwText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
