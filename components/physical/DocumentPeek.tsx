import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import PDFService, { PDFBarcode, PDFDocument } from '../../services/PDFService';
import { extractPdfInsights, PDFInsights } from '../../services/PDFTextService';
import { BarcodeSheet } from './BarcodeSheet';
import { ObjectType } from './theme';

interface DocumentPeekProps {
  document: PDFDocument | null;
  accent: string;
  /** Paper colour of the containing object, used by the pass view. */
  paper?: string;
  /** Which pass-field layout the document gets. */
  objectType?: ObjectType;
  /** Multi-stop tint for the glass pass. */
  gradient?: string[];
  visible: boolean;
  onClose: () => void;
  onOpenOriginal: (document: PDFDocument) => void;
  onDelete?: (document: PDFDocument) => void;
  onRename?: (document: PDFDocument) => void;
}

interface FieldGroup {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  values: string[];
}

/**
 * "X-ray" view of a document: the PDF's contents are read on-device
 * (never leaving the phone) and laid out on a sheet of frosted glass.
 */
export function DocumentPeek({ document, accent, paper = '#f6efdf', objectType = 'folder', gradient, visible, onClose, onOpenOriginal, onDelete, onRename }: DocumentPeekProps) {
  const [insights, setInsights] = useState<PDFInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [barcode, setBarcode] = useState<PDFBarcode | null>(null);
  const [showBarcode, setShowBarcode] = useState(false);

  // `undefined` means the document predates barcode extraction, so scan it once
  // now; `null` means it was scanned and genuinely has no symbol.
  useEffect(() => {
    if (!visible || !document) {
      setBarcode(null);
      return;
    }

    if (document.barcode !== undefined) {
      setBarcode(document.barcode);
      return;
    }

    // A shown document has no barcode to find; render its page instead.
    if (document.preview !== undefined || objectType === 'passport') {
      PDFService.ensurePreview(document.id).catch(() => {});
      setBarcode(null);
      return;
    }

    let cancelled = false;
    PDFService.ensureBarcode(document.id)
      .then((found) => {
        if (!cancelled) setBarcode(found);
      })
      .catch(() => {
        if (!cancelled) setBarcode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, document, objectType]);

  useEffect(() => {
    if (!visible || !document) {
      setInsights(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    extractPdfInsights(document.filePath)
      .then((result) => {
        if (!cancelled) setInsights(result);
      })
      .catch(() => {
        if (!cancelled) setInsights(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, document]);

  if (!document) return null;

  const groups: FieldGroup[] = insights
    ? (
        [
          { icon: 'calendar-outline', label: 'Dates', values: insights.dates },
          { icon: 'time-outline', label: 'Times', values: insights.times },
          { icon: 'airplane-outline', label: 'Flights', values: insights.flights },
          { icon: 'pricetag-outline', label: 'References', values: insights.references },
          { icon: 'cash-outline', label: 'Amounts', values: insights.amounts },
        ] as FieldGroup[]
      ).filter((g) => g.values.length > 0)
    : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={50} tint="dark" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.panelWrap}>
          <BlurView intensity={85} tint="light" style={styles.panel}>
            <View style={styles.panelTint} pointerEvents="none" />
            <View style={styles.glassEdge} pointerEvents="none" />

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.docIcon, { backgroundColor: accent }]}>
                <Ionicons name="document-text" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={styles.docNameRow}
                  onPress={onRename ? () => onRename(document) : undefined}
                  disabled={!onRename}
                  activeOpacity={0.7}
                >
                  <Text style={styles.docName} numberOfLines={3}>
                    {document.name}
                  </Text>
                  {onRename && <Ionicons name="pencil" size={12} color="#64748b" />}
                </TouchableOpacity>
                <Text style={styles.docMeta}>
                  {document.traveler} · {document.fileSize}
                </Text>
              </View>
              {onDelete && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => onDelete(document)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Sits above the text branches on purpose: a scanned pass often has
                no extractable text but still carries the code that matters. */}
            {barcode && (
              <Animated.View entering={FadeInUp.springify()}>
                <TouchableOpacity
                  style={styles.barcodeCard}
                  onPress={() => setShowBarcode(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${barcode.symbology} code full screen`}
                >
                  <Image
                    source={{ uri: barcode.uri }}
                    style={styles.barcodeImage}
                    contentFit="contain"
                    allowDownscaling={false}
                  />
                  <View style={styles.barcodeFooter}>
                    <Text style={styles.barcodeMeta}>{barcode.symbology}</Text>
                    <View style={styles.barcodeExpand}>
                      <Ionicons name="expand-outline" size={12} color="#475569" />
                      <Text style={styles.barcodeExpandText}>Tap to scan</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={accent} />
                <Text style={styles.loadingText}>Reading document…</Text>
              </View>
            ) : !insights || insights.empty ? (
              <View style={styles.loadingBox}>
                <Ionicons name="eye-off-outline" size={28} color="#94a3b8" />
                <Text style={styles.loadingText}>
                  {barcode
                    ? 'The text on this one can’t be read here, but its code is ready to scan above.'
                    : 'This document can’t be read here — it may be a scan. You can still open it below.'}
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {groups.map((group, gi) => (
                  <Animated.View
                    key={group.label}
                    entering={FadeInUp.springify().delay(80 + gi * 70)}
                    style={styles.group}
                  >
                    <View style={styles.groupHeader}>
                      <Ionicons name={group.icon} size={13} color={accent} />
                      <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
                    </View>
                    <View style={styles.chipRow}>
                      {group.values.map((v) => (
                        <View key={v} style={[styles.chip, { borderColor: accent }]}>
                          <Text style={[styles.chipText, { color: '#1e293b' }]}>{v}</Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                ))}

                <Animated.View
                  entering={FadeInDown.springify().delay(160 + groups.length * 70)}
                  style={styles.excerptBox}
                >
                  <Text style={styles.excerptLabel}>CONTENTS</Text>
                  {insights.lines.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.docScroll}
                      contentContainerStyle={styles.docContent}
                    >
                      <View>
                        {insights.lines.map((line, li) =>
                          line.text.trim() === '' ? (
                            <View key={li} style={styles.docGap} />
                          ) : (
                            <Text
                              key={li}
                              numberOfLines={1}
                              style={[styles.docLine, line.heading && styles.docHeading]}
                            >
                              {line.text}
                            </Text>
                          )
                        )}
                      </View>
                    </ScrollView>
                  ) : (
                    <Text style={styles.excerpt} numberOfLines={14}>
                      {insights.text}
                    </Text>
                  )}
                </Animated.View>
              </ScrollView>
            )}

            {/* Footer */}
            <TouchableOpacity
              style={[styles.openButton, { backgroundColor: accent }]}
              onPress={() => onOpenOriginal(document)}
              activeOpacity={0.85}
            >
              <Ionicons name="reader-outline" size={16} color="#fff" />
              <Text style={styles.openButtonText}>Open Original</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </BlurView>

      {/* Opened from inside the peek, so it's a deck of one. */}
      <BarcodeSheet
        items={barcode ? [{ document, barcode, accent, gradient, paper, objectType }] : []}
        initialIndex={0}
        visible={showBarcode}
        onClose={() => setShowBarcode(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  // White, not frosted: the code needs contrast more than it needs to match
  // the rest of the panel.
  barcodeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  barcodeImage: {
    width: '100%',
    height: 120,
  },
  barcodeFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barcodeMeta: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#64748b',
  },
  barcodeExpand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barcodeExpandText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panelWrap: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '78%',
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
    maxHeight: '100%',
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
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  docNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  docName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  docMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15,23,42,0.08)',
    marginVertical: 14,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  body: {
    flexGrow: 0,
  },
  group: {
    marginBottom: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 7,
  },
  groupLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#8e8e93',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
  },
  excerptBox: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: 14,
    marginBottom: 6,
  },
  excerptLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#8e8e93',
    marginBottom: 8,
  },
  excerpt: {
    fontSize: 11,
    lineHeight: 17,
    color: '#334155',
    fontFamily: 'SpaceMono',
  },
  docScroll: {
    maxHeight: 320,
  },
  docContent: {
    paddingRight: 12,
  },
  docLine: {
    fontSize: 11,
    lineHeight: 16,
    color: '#334155',
    fontFamily: 'SpaceMono',
  },
  docHeading: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '700',
  },
  docGap: {
    height: 7,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  openButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
