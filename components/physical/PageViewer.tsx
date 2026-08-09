import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as BarcodeService from '../../services/BarcodeService';
import { DocumentPreview } from '../../services/BarcodeService';
import { PDFDocument } from '../../services/PDFService';

const KEEP_AWAKE_TAG = 'travelet-pages';

interface PageViewerProps {
  document: PDFDocument | null;
  visible: boolean;
  onClose: () => void;
  onOpenOriginal?: (document: PDFDocument) => void;
}

/**
 * Reads a document in the app, as rendered page images.
 *
 * The card already shows page one, and a page image is just an image — so
 * showing the whole thing is a matter of rendering the rest rather than
 * reaching for a PDF viewer. Images pinch, page and load instantly once cached,
 * which for a passport being held up at a desk matters more than anything a
 * full viewer adds. The original PDF stays one tap away for the cases where it
 * doesn't.
 */
export function PageViewer({ document, visible, onClose, onOpenOriginal }: PageViewerProps) {
  // Measured, not the 58 that happened to suit one phone.
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [pages, setPages] = useState<DocumentPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !document) {
      setPages([]);
      setIndex(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    BarcodeService.pages(document.filePath, document.id)
      .then((rendered) => {
        if (!cancelled) setPages(rendered);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, document]);

  if (!document) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
          {pages.map((page) => (
            // Each page is its own zoomable surface, so pinching one doesn't
            // drag the others along with it.
            <ScrollView
              key={page.file}
              style={{ width, height }}
              contentContainerStyle={styles.pageWrap}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: page.uri }}
                style={{ width, height: height * 0.86 }}
                contentFit="contain"
              />
            </ScrollView>
          ))}
        </ScrollView>

        {loading && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color="#fff" />
            <Text style={styles.loadingText}>Rendering pages…</Text>
          </View>
        )}

        {!loading && pages.length === 0 && (
          <View style={styles.loading} pointerEvents="none">
            <Ionicons name="document-outline" size={34} color="rgba(255,255,255,0.6)" />
            <Text style={styles.loadingText}>This one couldn’t be rendered.</Text>
          </View>
        )}

        <BlurView
          intensity={40}
          tint="dark"
          style={[styles.bar, { paddingTop: insets.top + 6 }]}
        >
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.barButton}>
            <Ionicons name="close" size={20} color="#f8fafc" />
          </TouchableOpacity>

          <View style={styles.barCentre}>
            <Text style={styles.title} numberOfLines={1}>
              {document.name}
            </Text>
            {pages.length > 1 && (
              <Text style={styles.count}>
                Page {index + 1} of {pages.length}
              </Text>
            )}
          </View>

          {onOpenOriginal ? (
            <TouchableOpacity
              onPress={() => onOpenOriginal(document)}
              hitSlop={10}
              style={styles.barButton}
            >
              <Ionicons name="reader-outline" size={19} color="#f8fafc" />
            </TouchableOpacity>
          ) : (
            <View style={styles.barButton} />
          )}
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0b1220' },
  pageWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  barButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barCentre: { flex: 1, alignItems: 'center' },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#f8fafc',
  },
  count: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
});
