import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilePicker } from './FilePicker';
import PDFService, { PDFDocument } from '../services/PDFService';

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
}

export function AddDocumentModal({ 
  visible, 
  categoryId, 
  categoryName, 
  onClose, 
  onDocumentAdded 
}: AddDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [travelerName, setTravelerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelected = (file: FileInfo) => {
    setSelectedFile(file);
  };

  const handleAddDocument = async () => {
    if (!selectedFile) {
      Alert.alert('No File Selected', 'Please select a PDF file first.');
      return;
    }

    if (!travelerName.trim()) {
      Alert.alert('No Traveler Name', 'Please enter a traveler name.');
      return;
    }

    setIsLoading(true);
    try {
      let filePath = '';
      
      if (Platform.OS === 'web') {
        // For web, we'll use the file name as the path
        filePath = selectedFile.name;
      } else {
        // For mobile, use the file copy URI
        filePath = selectedFile.fileCopyUri || selectedFile.uri || '';
      }

      const document = await PDFService.addDocument(
        categoryId,
        filePath,
        selectedFile.name || 'Unknown Document',
        travelerName.trim()
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

  const resetForm = () => {
    setSelectedFile(null);
    setTravelerName('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Document to {categoryName}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
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
                <Text style={styles.fileInfoText}>File selected: {selectedFile.name}</Text>
                {selectedFile.size && (
                  <Text style={styles.fileSizeText}>
                    Size: {Platform.OS === 'web' ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Unknown'}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Traveler Name Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Traveler Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter traveler name"
              value={travelerName}
              onChangeText={setTravelerName}
              autoCapitalize="words"
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  fileInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  fileInfoText: {
    fontSize: 14,
    color: '#15803d',
    marginTop: 4,
  },
  fileSizeText: {
    fontSize: 12,
    color: '#15803d',
    marginTop: 4,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
