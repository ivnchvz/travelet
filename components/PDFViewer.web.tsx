import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PDFViewerProps {
    visible: boolean;
    filePath: string;
    documentName: string;
    onClose: () => void;
}

export function PDFViewer({ visible, filePath, documentName, onClose }: PDFViewerProps) {
    if (!visible) return null;

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
                    <View style={styles.infoBox}>
                        <Text style={styles.webInfo}>
                            <Text style={styles.label}>Document:</Text> {documentName}
                        </Text>
                        <Text style={styles.webInfo}>
                            <Text style={styles.label}>Path:</Text> {filePath}
                        </Text>
                    </View>
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
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
        marginRight: 16,
    },
    closeButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
    },
    webContent: {
        flex: 1,
        backgroundColor: '#f9fafb',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    webTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1f2937',
        marginTop: 24,
        marginBottom: 12,
    },
    webSubtitle: {
        fontSize: 18,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 28,
        maxWidth: 400,
    },
    infoBox: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        width: '100%',
        maxWidth: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    webInfo: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 8,
        fontFamily: 'monospace',
    },
    label: {
        fontWeight: '700',
        color: '#374151',
    },
});
