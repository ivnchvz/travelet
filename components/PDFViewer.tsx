import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PDFViewerProps {
  visible: boolean;
  filePath: string;
  documentName: string;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export function PDFViewer({ visible, filePath, documentName, onClose }: PDFViewerProps) {
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The bar sits under the status bar, so it has to know how tall that is.
   *
   * It used to pad down by a flat 50, which is nobody's inset in particular —
   * a hair too much on an older phone and nine points short on one with an
   * island, where it left the row riding up into the clock.
   */
  const insets = useSafeAreaInsets();
  const headerStyle = [styles.header, { paddingTop: insets.top + 6 }];

  useEffect(() => {
    async function checkFile() {
      if (Platform.OS !== 'web' && filePath) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          setFileExists(fileInfo.exists);
          if (!fileInfo.exists) {
            console.error('File does not exist:', filePath);
            setError('PDF file not found');
          } else {
            console.log('File exists:', filePath);
          }
        } catch (err) {
          console.error('Error checking file:', err);
          setError('Failed to verify PDF file');
        }
      }
    }
    if (visible && filePath) {
      checkFile();
    }
  }, [filePath, visible]);

  if (!visible) return null;

  // Show error if file doesn't exist or there's another issue
  if (fileExists === false || error) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.container}>
          <View style={headerStyle}>
            <Text style={styles.title} numberOfLines={1}>
              {documentName}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.errorText}>{error || 'PDF file not found'}</Text>
        </View>
      </Modal>
    );
  }

  // Show loading state while checking file
  if (fileExists === null) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.container}>
          <View style={headerStyle}>
            <Text style={styles.title} numberOfLines={1}>
              {documentName}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.errorText}>Loading PDF...</Text>
        </View>
      </Modal>
    );
  }

  // For mobile, use react-native-pdf to render the PDF
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        <View style={headerStyle}>
          <Text style={styles.title} numberOfLines={1}>
            {documentName}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <Pdf
          source={{ uri: filePath, cache: true }}
          style={styles.pdf}
          onError={(error: any) => {
            console.error('PDF rendering error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setError(`Failed to load PDF: ${errorMessage}`);
          }}
          onLoadComplete={(numberOfPages, filePath) => {
            console.log(`PDF loaded: ${numberOfPages} pages from ${filePath}`);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  /**
   * Sized, rather than however large its padding happened to make it.
   *
   * A round button drawn out of padding is only a circle by coincidence, and
   * the icon inside it only centred by coincidence too. Giving it a size and
   * centring the glyph puts it on the same optical line as the title beside it.
   */
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  pdf: {
    flex: 1,
    width,
    height,
  },
  webContent: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  webTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  webInfo: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 20,
  },
});