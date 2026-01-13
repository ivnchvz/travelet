import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
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
  existingNames?: string[]; // Names already used in categories
}

export function FilePicker({ 
  onFileSelected, 
  title = "Select PDF Document", 
  buttonText = "Choose PDF File", 
  existingNames = []
}: FilePickerProps) {
  // Store previously picked names in local state (for session)
  const [previousNames, setPreviousNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState<string>("");
  const pickDocument = async (nameOverride?: string) => {
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

          if (!previousNames.includes(file.name)) {
            setPreviousNames([...previousNames, file.name]);
          }
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

          // Use override name if provided
          const finalName = nameOverride || file.name || 'Unknown Document';
          const mobileFile = {
            name: finalName,
            size: file.size,
            type: file.type || 'application/pdf',
            uri: file.uri,
            fileCopyUri: file.fileCopyUri || file.uri,
          };
          if (finalName && !previousNames.includes(finalName)) {
            setPreviousNames([...previousNames, finalName]);
          }
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
                if (!previousNames.includes(sampleFile.name)) {
                  setPreviousNames([...previousNames, sampleFile.name]);
                }
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
                if (!previousNames.includes(mockFile.name)) {
                  setPreviousNames([...previousNames, mockFile.name]);
                }
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
      <TouchableOpacity style={styles.button} onPress={() => pickDocument(selectedName)}>
        <Ionicons name="document" size={20} color="#6b7280" />
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
      {Platform.OS !== 'web' && (
        <Text style={styles.hint}>
          Tap to select a PDF from your phone's storage
        </Text>
      )}

      {/* Shortcuts for traveler names with attached documents */}
      {existingNames.length > 0 && (
        <View style={styles.shortcutContainer}>
          <Text style={styles.shortcutLabel}>Attach to an existing traveler:</Text>
          <View style={styles.shortcutList}>
            {existingNames.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.shortcutButton}
                onPress={() => pickDocument(name)}
              >
                <Text style={styles.shortcutText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {/* Shortcuts for previously picked names in session */}
      {previousNames.length > 0 && (
        <View style={styles.shortcutContainer}>
          <Text style={styles.shortcutLabel}>Names picked in this session:</Text>
          <View style={styles.shortcutList}>
            {previousNames.map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.shortcutButton, selectedName === name && styles.shortcutButtonSelected]}
                onPress={() => setSelectedName(name)}
              >
                <Text style={styles.shortcutText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
  shortcutContainer: {
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
  },
  shortcutLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    textAlign: 'center',
  },
  shortcutList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
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
});
