import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { PDFCategory as IPDFCategory, PDFDocument } from '../services/PDFService';
import { AddDocumentModal } from './AddDocumentModal';
import { DocumentCard } from './DocumentCard';

interface DocumentCategoryProps {
  category: IPDFCategory;
  onDocumentAdded: (document: PDFDocument) => void;
  onDocumentDeleted: (document: PDFDocument) => void;
  onViewDocument: (document: PDFDocument) => void;
  style?: ViewStyle; // Allow overriding container style
}

export function DocumentCategory({ category, onDocumentAdded, onDocumentDeleted, onViewDocument, style }: DocumentCategoryProps) {
  const [selectedTraveler, setSelectedTraveler] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Get unique travelers from documents
  const travelers = useMemo(() => {
    const uniqueTravelers = Array.from(new Set(category.documents.map(doc => doc.traveler)));
    return uniqueTravelers.sort();
  }, [category.documents]);

  // Filter documents by selected traveler
  const filteredDocuments = useMemo(() => {
    if (selectedTraveler === "all") {
      return category.documents;
    }
    return category.documents.filter(doc => doc.traveler === selectedTraveler);
  }, [category.documents, selectedTraveler]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleDeleteDocument = async (document: PDFDocument) => {
    try {
      // Delete from storage and update categories
      await onDocumentDeleted(document);
    } catch (error) {
      console.error('Error deleting document:', error);
      const message = 'Failed to delete document. Please try again.';
      if (Platform.OS === 'web') {
        console.warn('Alert: ' + message);
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleAddDocument = (document: PDFDocument) => {
    onDocumentAdded(document);
    setShowAddModal(false);
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: category.color, borderColor: category.borderColor }, style]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.categoryName, { color: category.textColor }]}>
              {category.name}
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { borderColor: category.textColor }]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={16} color={category.textColor} />
              <Text style={[styles.addButtonText, { color: category.textColor }]}>Add Document</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Traveler Tabs */}
        {travelers.length > 0 && (
          <View style={styles.travelerTabs}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  selectedTraveler === "all" && { backgroundColor: category.accentColor, borderColor: category.textColor }
                ]}
                onPress={() => setSelectedTraveler("all")}
              >
                <Text style={[
                  styles.tabText,
                  selectedTraveler === "all" ? { color: category.textColor } : { color: '#6b7280' }
                ]}>
                  All ({category.documents.length})
                </Text>
              </TouchableOpacity>

              {travelers.map((traveler) => {
                const travelerDocCount = category.documents.filter(doc => doc.traveler === traveler).length;
                return (
                  <TouchableOpacity
                    key={traveler}
                    style={[
                      styles.tab,
                      selectedTraveler === traveler && { backgroundColor: category.accentColor, borderColor: category.textColor }
                    ]}
                    onPress={() => setSelectedTraveler(traveler)}
                  >
                    <View style={styles.tabContent}>
                      <View style={styles.travelerInitials}>
                        <Text style={styles.initialText}>{getInitials(traveler)}</Text>
                      </View>
                      <Text style={[
                        styles.tabText,
                        selectedTraveler === traveler ? { color: category.textColor } : { color: '#6b7280' }
                      ]}>
                        {traveler} ({travelerDocCount})
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Add Family Member Button */}
              <TouchableOpacity
                style={styles.addFamilyButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="person-add" size={14} color="#6b7280" />
                <Text style={styles.addFamilyText}>Add Traveler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Document Count */}
        <Text style={[styles.documentCount, { color: category.textColor }]}>
          {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
        </Text>

        {/* Documents List */}
        {filteredDocuments.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.documentsContainer}
            style={styles.documents}
          >
            {filteredDocuments.map((document) => (
              <View key={document.id} style={styles.documentWrapper}>
                <DocumentCard
                  document={document}
                  accentColor={category.accentColor}
                  textColor={category.textColor}
                  onView={onViewDocument}
                  onDelete={handleDeleteDocument}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: category.accentColor, borderColor: category.textColor }]}>
            <Text style={[styles.emptyStateText, { color: category.textColor }]}>
              {selectedTraveler === "all" ? "No documents yet" : `No documents for ${selectedTraveler}`}
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { borderColor: category.textColor }]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={16} color={category.textColor} />
              <Text style={[styles.emptyStateButtonText, { color: category.textColor }]}>
                {selectedTraveler === "all" ? "Add your first document" : `Add document for ${selectedTraveler}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Add Document Modal */}
      <AddDocumentModal
        visible={showAddModal}
        categoryId={category.id}
        categoryName={category.name}
        onClose={() => setShowAddModal(false)}
        onDocumentAdded={handleAddDocument}
        existingTravelerNames={travelers}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  travelerTabs: {
    marginBottom: 12,
  },
  tabsContainer: {
    paddingRight: 16,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  travelerInitials: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280', // gray-500
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabCount: {
    fontSize: 12,
    opacity: 0.8,
  },
  addFamilyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.3)',
  },
  addFamilyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  documentCount: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
  },
  documents: {
    marginBottom: 16,
  },
  documentsContainer: {
    paddingRight: 16,
  },
  documentWrapper: {
    width: 280,
    marginRight: 16,
  },
  emptyState: {
    padding: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    fontSize: 16,
    opacity: 0.8,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});