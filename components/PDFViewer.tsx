import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Pdf from 'react-native-pdf';

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

  // For web, show a placeholder since react-native-pdf doesn't work on web
  if (Platform.OS === 'web') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {documentName}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.webContent}>
            <Ionicons name="document-text" size={64} color="#6b7280" />
            <Text style={styles.webTitle}>PDF Viewer</Text>
            <Text style={styles.webSubtitle}>
              PDF viewing is available on mobile devices only.
            </Text>
            <Text style={styles.webInfo}>
              Document: {documentName}
            </Text>
            <Text style={styles.webInfo}>
              Path: {filePath}
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Show error if file doesn't exist or there's another issue
  if (fileExists === false || error) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {documentName}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
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
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {documentName}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
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
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {documentName}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
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
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
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