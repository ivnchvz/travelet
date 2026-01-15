import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import PDFService, { PDFDocument } from '../services/PDFService';
import { FilePicker } from './FilePicker';

interface FileInfo {
  name: string;
  size?: number;
  type?: string;
  uri?: string;
  fileCopyUri?: string;
}

interface AddDocumentModalProps {
  visible: boolean;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onDocumentAdded: (document: PDFDocument) => void;
  existingTravelerNames?: string[]; // Traveler names already used in this category
}

export function AddDocumentModal({
  visible,
  categoryId,
  categoryName,
  onClose,
  onDocumentAdded,
  existingTravelerNames = []
}: AddDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [travelerName, setTravelerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelected = (file: FileInfo) => {
    setSelectedFile(file);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTravelerName('');
  };

  const handleAddDocument = async () => {
    if (!selectedFile || !travelerName.trim() || isLoading) return;

    setIsLoading(true);

    try {
      // Use optional chaining and nullish coalescing to handle undefined size
      const filePath = selectedFile.uri ?? '';
      const originalName = selectedFile.name;
      const traveler = travelerName;

      const document = await PDFService.addDocument(
        categoryId,           // 1st argument: categoryId
        filePath,             // 2nd argument: filePath
        originalName,         // 3rd argument: originalName
        traveler              // 4th argument: traveler
      );
      onDocumentAdded(document);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error adding document:', error);
      Alert.alert('Error', 'Failed to add document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <View style={styles.innerContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Document to {categoryName}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* File Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select PDF File</Text>
              <FilePicker
                onFileSelected={handleFileSelected}
                title="Choose a PDF document"
                buttonText={selectedFile ? selectedFile.name : "Choose PDF File"}
              />
              {selectedFile && (
                <View style={styles.fileInfo}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={styles.fileSizeText}>
                    Size: {selectedFile.size !== undefined
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                      : 'Unknown'}
                  </Text>
                </View>
              )}
            </View>

            {/* Traveler Name Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Traveler Name</Text>
              {existingTravelerNames.length > 0 && (
                <View style={styles.shortcutContainer}>
                  <Text style={styles.shortcutLabel}>Existing Travelers</Text>
                  <View style={styles.shortcutList}>
                    {existingTravelerNames.map((name, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.shortcutButton}
                        onPress={() => setTravelerName(name)}
                      >
                        <Text style={styles.shortcutText}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <TextInput
                style={styles.input}
                placeholder="Enter traveler name"
                value={travelerName}
                onChangeText={setTravelerName}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            {/* Add Button */}
            <TouchableOpacity
              style={[
                styles.addButton,
                (!selectedFile || !travelerName.trim() || isLoading) && styles.addButtonDisabled
              ]}
              onPress={handleAddDocument}
              disabled={!selectedFile || !travelerName.trim() || isLoading}
            >
              {isLoading ? (
                <Text style={styles.addButtonText}>Adding...</Text>
              ) : (
                <>
                  <Ionicons name="add" size={20} color="white" />
                  <Text style={styles.addButtonText}>Add Document</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 80 : 0,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  explanation: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  fileInfoText: {
    fontSize: 14,
    color: '#6b7280',
  },
  fileSizeText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  shortcutContainer: {
    marginBottom: 8,
    alignItems: 'flex-start',
    width: '100%',
  },
  shortcutLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'left',
  },
  shortcutList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  shortcutButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  shortcutButtonSelected: {
    backgroundColor: '#d1d5db',
    borderColor: '#374151',
  },
  shortcutText: {
    fontSize: 13,
    color: '#374151',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});