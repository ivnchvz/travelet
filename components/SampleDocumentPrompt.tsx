import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Texture } from './physical/Texture';

interface SampleDocumentPromptProps {
  visible: boolean;
  /** Puts the sample on the shelf. Resolves once it is filed. */
  onAccept: () => Promise<void>;
  onSkip: () => void;
}

/**
 * The first thing after onboarding, when the shelf is still empty.
 *
 * Onboarding explains the app; this one shows it. A wallet with nothing in it
 * cannot demonstrate anything — the covers stay shut, the fan is empty, and
 * every feature worth seeing needs a document to happen to. One tap puts a real
 * pass in, which is both the fastest way to understand the app and the only way
 * someone with no travel PDFs on their phone can see it work at all.
 *
 * Built in the language the other modals speak: dark blur behind, light glass
 * panel, and the document itself drawn as a piece of paper.
 */
export function SampleDocumentPrompt({ visible, onAccept, onSkip }: SampleDocumentPromptProps) {
  const [adding, setAdding] = useState(false);

  if (!visible) return null;

  const accept = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await onAccept();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
      <BlurView intensity={50} tint="dark" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={adding ? undefined : onSkip} />

        <View style={styles.centre} pointerEvents="box-none">
          <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.panelWrap}>
            <BlurView intensity={85} tint="light" style={styles.panel}>
              <View style={styles.panelTint} pointerEvents="none" />
              <View style={styles.glassEdge} pointerEvents="none" />

              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="sparkles" size={17} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Start with a sample</Text>
                  <Text style={styles.subtitle}>So the shelf isn&apos;t empty</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* The pass itself, at the angle it would be handed over at. */}
              <Animated.View entering={FadeInUp.springify().delay(70)} style={styles.slipWrap}>
                <View style={styles.slip}>
                  <Texture variant="paper" opacity={0.6} />
                  <Text style={styles.slipAirline}>TRAVELET AIRWAYS</Text>
                  <View style={styles.slipRoute}>
                    <Text style={styles.slipCode}>MAD</Text>
                    <Ionicons name="airplane" size={13} color="#8a7d68" />
                    <Text style={styles.slipCode}>BCN</Text>
                  </View>
                  <Text style={styles.slipMeta}>TR 1042 · SEAT 14A · GATE B12</Text>
                </View>
              </Animated.View>

              <Text style={styles.body}>
                A real boarding pass, read the same way yours will be. Throw it away whenever
                you like.
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.skip]}
                  onPress={onSkip}
                  disabled={adding}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                >
                  <Text style={styles.skipText}>No thanks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.accept]}
                  onPress={accept}
                  disabled={adding}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  {adding ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.acceptText}>Add it</Text>
                  )}
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
  backdrop: { flex: 1 },
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
    backgroundColor: '#16a34a',
    shadowColor: '#14532d',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748b',
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15,23,42,0.08)',
    marginVertical: 14,
  },
  slipWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  slip: {
    width: 200,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f6f1e7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(67,57,44,0.28)',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  slipAirline: {
    fontSize: 8,
    fontFamily: 'SpaceMono',
    letterSpacing: 1.6,
    color: '#8a7d68',
  },
  slipRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  slipCode: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1,
    color: '#2b2318',
  },
  slipMeta: {
    fontSize: 8,
    fontFamily: 'SpaceMono',
    letterSpacing: 1,
    color: '#8a7d68',
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
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
  skip: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: '#334155',
  },
  accept: {
    backgroundColor: '#16a34a',
    shadowColor: '#14532d',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  acceptText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#ffffff',
  },
});
