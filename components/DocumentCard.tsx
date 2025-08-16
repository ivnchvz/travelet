import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PDFDocument } from '../services/PDFService';

interface DocumentCardProps {
  document: PDFDocument;
  accentColor: string;
  textColor: string;
  onView: (document: PDFDocument) => void;
  onDelete?: (document: PDFDocument) => void;
}

export function DocumentCard({ document, accentColor, textColor, onView, onDelete }: DocumentCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleView = () => {
    onView(document);
  };

  const handleDelete = () => {
    if (onDelete) {
      Alert.alert(
        'Delete Document',
        `Are you sure you want to delete "${document.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(document) }
        ]
      );
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Header with icon and menu */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: accentColor }]}>
            <Ionicons name="document-text" size={24} color="#6b7280" />
          </View>
          {onDelete && (
            <TouchableOpacity style={styles.menuButton} onPress={handleDelete}>
              <Ionicons name="trash" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Document info */}
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={2}>
            {document.name}
          </Text>
          
          {/* Traveler Badge */}
          <View style={styles.travelerBadge}>
            <View style={styles.travelerInitials}>
              <Text style={styles.initialText}>{getInitials(document.traveler)}</Text>
            </View>
            <Text style={styles.travelerName}>{document.traveler}</Text>
          </View>
          
          {/* Meta info */}
          <View style={styles.metaInfo}>
            <Text style={styles.metaText}>Added {formatDate(document.dateAdded)}</Text>
            <Text style={styles.metaText}>{document.fileSize}</Text>
          </View>
        </View>

        {/* Action button */}
        <TouchableOpacity style={styles.viewButton} onPress={handleView}>
          <Ionicons name="eye" size={16} color={textColor} />
          <Text style={[styles.viewButtonText, { color: textColor }]}>View</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 200,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 8,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
  },
  documentInfo: {
    flex: 1,
    marginBottom: 16,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827', // gray-900
    marginBottom: 8,
    lineHeight: 20,
  },
  travelerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  travelerInitials: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f3f4f6', // gray-100
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280', // gray-500
  },
  travelerName: {
    fontSize: 12,
    color: '#6b7280', // gray-500
  },
  metaInfo: {
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280', // gray-500
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb', // gray-200
    borderRadius: 6,
    backgroundColor: 'white',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
