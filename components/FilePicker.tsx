import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FileInfo {
  name: string;
  size?: number;
  type?: string;
  uri?: string;
  fileCopyUri?: string;
}

interface FilePickerProps {
  onFileSelected: (file: FileInfo) => void;
  title?: string;
  buttonText?: string;
}

export function FilePicker({ 
  onFileSelected, 
  title = "Select PDF Document", 
  buttonText = "Choose PDF File" 
}: FilePickerProps) {
  const pickDocument = async () => {
    if (Platform.OS === 'web') {
      // For web, we'll use the HTML file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          
          // Validate file type
          if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            Alert.alert('Invalid File Type', 'Please select a PDF file.');
            return;
          }

          // Validate file size (max 50MB)
          if (file.size > 50 * 1024 * 1024) {
            Alert.alert('File Too Large', 'Please select a PDF file smaller than 50MB.');
            return;
          }

          // Create a mock file object that matches the expected interface
          const mockFile = {
            name: file.name,
            size: file.size,
            type: file.type,
            uri: URL.createObjectURL(file),
            fileCopyUri: URL.createObjectURL(file),
          };

          onFileSelected(mockFile);
        }
      };
      input.click();
    } else {
      // For mobile, try to use the document picker
      try {
        // Try to import dynamically
        let DocumentPicker;
        try {
          DocumentPicker = require('react-native-document-picker').default;
        } catch (importError) {
          console.log('DocumentPicker not available, trying alternative method');
          // Fallback: try to use Expo Document Picker
          try {
            DocumentPicker = require('expo-document-picker').default;
          } catch (expoError) {
            throw new Error('No document picker available');
          }
        }
        
        const result = await DocumentPicker.pick({
          type: [DocumentPicker.types.pdf],
          copyTo: 'cachesDirectory',
          allowMultiSelection: false,
          presentationStyle: 'fullScreen',
        });

        if (result && result.length > 0) {
          const file = result[0];
          
          console.log('Selected file:', file);
          
          // Validate file type
          if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
            Alert.alert('Invalid File Type', 'Please select a PDF file.');
            return;
          }

          // Validate file size (max 50MB)
          if (file.size && file.size > 50 * 1024 * 1024) {
            Alert.alert('File Too Large', 'Please select a PDF file smaller than 50MB.');
            return;
          }

          // Create a standardized file object
          const mobileFile = {
            name: file.name || 'Unknown Document',
            size: file.size,
            type: file.type || 'application/pdf',
            uri: file.uri,
            fileCopyUri: file.fileCopyUri || file.uri,
          };

          console.log('Processed file:', mobileFile);
          onFileSelected(mobileFile);
        }
      } catch (err: any) {
        console.error('Error picking document:', err);
        
        // Check if it's a cancel error
        if (err?.code === 'E_DOCUMENT_PICKER_CANCELED' || err?.message?.includes('cancel')) {
          return; // User cancelled, don't show error
        }
        
        // Show helpful error message with options
        Alert.alert(
          'Document Picker Not Available', 
          'File picking has limitations in Expo Go. Choose an option:',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Use Sample PDF', 
              onPress: () => {
                const sampleFile = {
                  name: 'sample-document.pdf',
                  size: 2048,
                  type: 'application/pdf',
                  uri: 'mock://sample.pdf',
                  fileCopyUri: 'mock://sample.pdf',
                };
                onFileSelected(sampleFile);
              }
            },
            { 
              text: 'Enter File Name', 
              onPress: () => {
                // For now, just create a mock file
                const mockFile = {
                  name: 'manual-entry.pdf',
                  size: 1024,
                  type: 'application/pdf',
                  uri: 'mock://manual.pdf',
                  fileCopyUri: 'mock://manual.pdf',
                };
                onFileSelected(mockFile);
              }
            }
          ]
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity style={styles.button} onPress={pickDocument}>
        <Ionicons name="document" size={20} color="#6b7280" />
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
      {Platform.OS !== 'web' && (
        <Text style={styles.hint}>
          Tap to select a PDF from your phone's storage
        </Text>
      )}
      {Platform.OS !== 'web' && (
        <Text style={styles.warning}>
          ⚠️ Expo Go has limited file access. Use "Use Sample PDF" to test.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  warning: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
});
