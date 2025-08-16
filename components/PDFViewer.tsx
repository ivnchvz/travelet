import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PDFViewerProps {
  visible: boolean;
  filePath: string;
  documentName: string;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export function PDFViewer({ visible, filePath, documentName, onClose }: PDFViewerProps) {
  if (!visible) return null;

  // For web, we'll show a placeholder since react-native-pdf doesn't work on web
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

  // For mobile, we'll use the native PDF viewer
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {documentName}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* PDF Content - Only for mobile */}
        <View style={styles.pdfContainer}>
          <Text style={styles.mobileInfo}>
            PDF viewer will be implemented for mobile devices.
          </Text>
          <Text style={styles.mobileInfo}>
            Document: {documentName}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  pdfContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mobileInfo: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
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
});
