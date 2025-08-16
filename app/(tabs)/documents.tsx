import { DocumentCategory } from '@/components/DocumentCategory';
import { PDFViewer } from '@/components/PDFViewer';
import { AddDocumentModal } from '@/components/AddDocumentModal';
import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PDFService, { PDFCategory, PDFDocument } from '@/services/PDFService';

export default function DocumentsScreen() {
  const [categories, setCategories] = useState<PDFCategory[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PDFDocument | null>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const loadedCategories = await PDFService.getCategories();
      setCategories(loadedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentAdded = async (document: PDFDocument) => {
    try {
      // Reload categories to get the updated data
      await loadCategories();
    } catch (error) {
      console.error('Error reloading categories:', error);
    }
  };

  const handleDocumentDeleted = async (document: PDFDocument) => {
    try {
      // Find the category containing this document
      const category = categories.find(c => c.documents.some(d => d.id === document.id));
      if (category) {
        await PDFService.deleteDocument(category.id, document.id);
        // Reload categories to get the updated data
        await loadCategories();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  const handleViewDocument = (document: PDFDocument) => {
    setSelectedDocument(document);
    setShowPDFViewer(true);
  };

  const handleClosePDFViewer = () => {
    setShowPDFViewer(false);
    setSelectedDocument(null);
  };

  const handleAddCategory = async (name: string, color: string, borderColor: string, accentColor: string, textColor: string) => {
    try {
      await PDFService.addCategory(name, color, borderColor, accentColor, textColor);
      await loadCategories();
      setShowAddCategoryModal(false);
    } catch (error) {
      console.error('Error adding category:', error);
      Alert.alert('Error', 'Failed to add category. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Travel Document Manager</Text>
            <Text style={styles.subtitle}>
              Organize and store your travel documents securely
            </Text>
          </View>

          {/* Categories */}
          <View style={styles.categories}>
            {categories.map((category) => (
              <DocumentCategory
                key={category.id}
                category={category}
                onDocumentAdded={handleDocumentAdded}
                onDocumentDeleted={handleDocumentDeleted}
                onViewDocument={handleViewDocument}
              />
            ))}
          </View>

          {/* Add New Category Button */}
          <View style={styles.addCategoryContainer}>
            <TouchableOpacity 
              style={styles.addCategoryButton}
              onPress={() => setShowAddCategoryModal(true)}
            >
              <Ionicons name="add" size={20} color="#6b7280" />
              <Text style={styles.addCategoryText}>Add New Category</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* PDF Viewer */}
      {selectedDocument && (
        <PDFViewer
          visible={showPDFViewer}
          filePath={selectedDocument.filePath}
          documentName={selectedDocument.name}
          onClose={handleClosePDFViewer}
        />
      )}

      {/* Add Category Modal - Simple implementation for now */}
      {showAddCategoryModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Category</Text>
            <Text style={styles.modalText}>
              This feature is coming soon! For now, you can use the existing categories.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowAddCategoryModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // gray-50
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827', // gray-900
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280', // gray-500
    lineHeight: 24,
  },
  categories: {
    gap: 32,
  },
  addCategoryContainer: {
    marginTop: 48,
    alignItems: 'center',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#d1d5db', // gray-300
    borderRadius: 8,
    backgroundColor: 'white',
  },
  addCategoryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280', // gray-500
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
