import { AddCategoryModal } from '@/components/AddCategoryModal';
import { DocumentCategory } from '@/components/DocumentCategory';
import { PDFViewer } from '@/components/PDFViewer';
import PDFService, { PDFDocument } from '@/services/PDFService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { SafeAreaView } from 'react-native-safe-area-context';

// Carousel item height relative to screen - increased to prevent cut-off
const ITEM_HEIGHT_RATIO = 0.6;

export default function DocumentsScreen() {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [dimensions, setDimensions] = useState({ width: 375, height: 750 });
  const [isMounted, setIsMounted] = useState(false);

  const [categories, setCategories] = useState<any[]>([]); // Use any[] temporarily if PDFCategory is not imported correctly, or just PDFCategory[]
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [declareItems, setDeclareItems] = useState<string[]>([]);
  const [declareInput, setDeclareInput] = useState('');
  const [containerHeight, setContainerHeight] = useState(0);
  const [isPagingEnabled, setIsPagingEnabled] = useState(true);

  // Dimensions for the app
  const SCREEN_WIDTH = dimensions.width;
  const SCREEN_HEIGHT = dimensions.height;

  // Height of each card in the carousel
  const itemHeight = SCREEN_HEIGHT * ITEM_HEIGHT_RATIO;

  useEffect(() => {
    setIsMounted(true);
    setDimensions({ width: winWidth, height: winHeight });
    loadCategories();
    loadDeclareItems();

    // Check for Windows on web to disable snapping (paging)
    if (Platform.OS === 'web') {
      const isWindows = /Win/.test(navigator.platform) || /Windows/.test(navigator.userAgent);
      if (isWindows) {
        setIsPagingEnabled(false);
      }
    }
  }, [winWidth, winHeight]);

  const loadDeclareItems = async () => {
    try {
      const items = await PDFService.getDeclareItems();
      setDeclareItems(items);
    } catch (error) {
      console.error('Error loading declare items:', error);
    }
  };

  const saveDeclareItems = async (items: string[]) => {
    try {
      await PDFService.saveDeclareItems(items);
    } catch (error) {
      console.error('Error saving declare items:', error);
    }
  };

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedCategories = await PDFService.getCategories();
      setCategories(loadedCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
      if (Platform.OS === 'web') {
        console.warn('Alert: ' + message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentAdded = async (document: PDFDocument) => {
    try {
      await loadCategories();
    } catch (error) {
      console.error('Error reloading categories:', error);
    }
  };

  const handleDocumentDeleted = async (document: PDFDocument) => {
    try {
      const category = categories.find((c: any) => c.documents.some((d: any) => d.id === document.id));
      if (category) {
        await PDFService.deleteDocument(category.id, document.id);
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={[styles.loadingText, { color: '#ef4444', marginTop: 16 }]}>
            Error: {error}
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 24,
              paddingVertical: 12,
              paddingHorizontal: 24,
              backgroundColor: '#6366f1',
              borderRadius: 8
            }}
            onPress={loadCategories}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Combine Declare section and Categories into a single data array for the Carousel
  const carouselData = [
    { type: 'declare', id: 'declare-section' },
    ...categories.map(c => ({ type: 'category', ...c })),
    { type: 'add', id: 'add-category-button' },
  ];

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'declare') {
      return (
        <View style={styles.carouselItemContainer}>
          <View style={{ flex: 1, marginVertical: 10 }}>
            <View style={[styles.declareSection, { flex: 1, marginBottom: 0 }]}>
              <Text style={styles.declareTitle}>Things to Declare</Text>
              <Text style={styles.declareSubtitle}>
                Add items you need to declare for customs or travel.
              </Text>
              <View style={styles.declareInputRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.declareInput}
                    placeholder="Add an item..."
                    value={declareInput}
                    onChangeText={setDeclareInput}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (declareInput.trim()) {
                        const newItems = [...declareItems, declareInput.trim()];
                        setDeclareItems(newItems);
                        saveDeclareItems(newItems);
                        setDeclareInput('');
                      }
                    }}
                  />
                </View>
                <TouchableOpacity
                  style={styles.declareAddButton}
                  onPress={() => {
                    if (declareInput.trim()) {
                      const newItems = [...declareItems, declareInput.trim()];
                      setDeclareItems(newItems);
                      saveDeclareItems(newItems);
                      setDeclareInput('');
                    }
                  }}
                >
                  <Ionicons name="add" size={20} color="#6366F1" />
                </TouchableOpacity>
              </View>
              <View style={styles.declareList}>
                {declareItems.length === 0 ? (
                  <Text style={styles.declareItemMuted}>No items yet.</Text>
                ) : (
                  declareItems.map((childItem, idx) => (
                    <View key={idx} style={styles.declareItemRow}>
                      <Text style={styles.declareItem}>• {childItem}</Text>
                      <TouchableOpacity
                        style={styles.declareRemoveButton}
                        onPress={() => {
                          const newItems = declareItems.filter((_, i) => i !== idx);
                          setDeclareItems(newItems);
                          saveDeclareItems(newItems);
                        }}
                      >
                        <Ionicons name="close" size={18} color="#A5B4FC" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (item.type === 'add') {
      return (
        <View style={styles.carouselItemContainer}>
          <TouchableOpacity
            style={styles.addCategoryCard}
            onPress={() => setShowAddCategoryModal(true)}
          >
            <View style={styles.addCategoryIconContainer}>
              <Ionicons name="add" size={40} color="#6366f1" />
            </View>
            <Text style={styles.addCategoryTitle}>Add Category</Text>
            <Text style={styles.addCategorySubtitle}>Create a new space for your documents</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.carouselItemContainer}>
        <View style={{ flex: 1, marginVertical: 10 }}>
          <DocumentCategory
            category={item}
            onDocumentAdded={handleDocumentAdded}
            onDocumentDeleted={handleDocumentDeleted}
            onViewDocument={handleViewDocument}
            style={{ flex: 1, marginBottom: 0 }}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <View
          style={styles.carouselWrapper}
          onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
        >
          {containerHeight > 0 && (
            <Carousel
              vertical
              style={{
                width: SCREEN_WIDTH,
                height: containerHeight,
              }}
              width={SCREEN_WIDTH}
              height={itemHeight}
              data={carouselData}
              loop={false}
              renderItem={renderItem}
              mode="parallax"
              modeConfig={{
                parallaxScrollingScale: 0.95,
                parallaxScrollingOffset: 40,
                parallaxAdjacentItemScale: 0.92,
              }}
              defaultIndex={0}
              pagingEnabled={isPagingEnabled} // Dynamic snapping
              snapEnabled={isPagingEnabled} // Disable snapping altogether for Windows Web
            />
          )}
        </View>

        {/* Top Soft Gradient Overlay */}
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 1)',
            'rgba(255, 255, 255, 1)',
            'rgba(255, 255, 255, 0.9)',
            'rgba(255, 255, 255, 0.5)',
            'rgba(255, 255, 255, 0.1)',
            'rgba(255, 255, 255, 0)',
          ]}
          locations={[0, 0.55, 0.7, 0.8, 0.85, 1]}
          style={styles.topOverlay}
          pointerEvents="none"
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.traveletTitle}>travelet</Text>
            </View>
            <Text style={styles.explanation}>
              All your travel paperwork, effortlessly organized.
            </Text>
          </View>
        </LinearGradient>

        {/* Bottom Soft Gradient Overlay */}
        <LinearGradient
          colors={['rgba(249,249,251,0)', 'rgba(249,249,251,0.8)', '#f9fafb']}
          locations={[0, 0.3, 1]}
          style={styles.bottomOverlay}
          pointerEvents="none"
        />
      </View>

      {/* PDF Viewer */}
      {selectedDocument && (
        <PDFViewer
          visible={showPDFViewer}
          filePath={selectedDocument.filePath}
          documentName={selectedDocument.name}
          onClose={handleClosePDFViewer}
        />
      )}

      <AddCategoryModal
        visible={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onAdd={async (name, scheme) => {
          try {
            await PDFService.addCategory(
              name,
              scheme.color,
              scheme.borderColor,
              scheme.accentColor,
              scheme.textColor
            );
            await loadCategories();
            setShowAddCategoryModal(false);
          } catch (error) {
            Alert.alert('Error', 'Failed to add category');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  carouselWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 170, // Slightly reduced to blend better with the taller overlay
  },
  carouselItemContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10, // Create vertical gap between cards
  },
  declareInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  declareInput: {
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  declareAddButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 10,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  declareItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  declareRemoveButton: {
    marginLeft: 8,
    padding: 2,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#A5B4FC',
  },
  declareItemMuted: {
    fontSize: 16,
    color: '#A5B4FC',
    fontStyle: 'italic',
  },
  declareSection: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#E0E7FF', // indigo-100
    borderRadius: 12,
  },
  declareTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3730A3', // indigo-800
    marginBottom: 4,
  },
  addCategoryCard: {
    flex: 1,
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginVertical: 10,
  },
  addCategoryIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addCategoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  addCategorySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  declareSubtitle: {
    fontSize: 14,
    color: '#6366F1', // indigo-500
    marginBottom: 8,
  },
  declareList: {
    marginLeft: 8,
  },
  declareItem: {
    fontSize: 16,
    color: '#3730A3',
    marginBottom: 4,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 20,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250, // Slightly taller for an ultra-smooth fade
    zIndex: 10,
    paddingHorizontal: 16,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40, // Very subtle bottom overlay
    zIndex: 10,
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 50 : 10,
    marginBottom: 0,
  },
  traveletTitle: {
    fontSize: 32,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    color: '#3696F8',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'BeVietnamPro-BoldItalic',
    textTransform: 'none',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerAddButton: {
    padding: 4,
  },
  explanation: {
    fontSize: 16,
    color: '#6b7280', // gray-500
    lineHeight: 24,
    marginBottom: 0,
    textAlign: 'center',
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
});
