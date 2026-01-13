import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ColorScheme {
    id: string;
    name: string;
    color: string;
    borderColor: string;
    accentColor: string;
    textColor: string;
}

const COLOR_SCHEMES: ColorScheme[] = [
    { id: 'indigo', name: 'Indigo', color: '#e0e7ff', borderColor: '#c7d2fe', accentColor: '#c7d2fe', textColor: '#3730a3' },
    { id: 'blue', name: 'Blue', color: '#eff6ff', borderColor: '#bfdbfe', accentColor: '#dbeafe', textColor: '#1d4ed8' },
    { id: 'green', name: 'Green', color: '#f0fdf4', borderColor: '#bbf7d0', accentColor: '#dcfce7', textColor: '#15803d' },
    { id: 'purple', name: 'Purple', color: '#faf5ff', borderColor: '#d8b4fe', accentColor: '#e9d5ff', textColor: '#7c3aed' },
    { id: 'red', name: 'Red', color: '#fff1f2', borderColor: '#fecaca', accentColor: '#fecaca', textColor: '#dc2626' },
    { id: 'orange', name: 'Orange', color: '#fffbeb', borderColor: '#fde68a', accentColor: '#fef3c7', textColor: '#d97706' },
    { id: 'teal', name: 'Teal', color: '#f0fdfa', borderColor: '#99f6e4', accentColor: '#ccfbf1', textColor: '#0f766e' },
    { id: 'pink', name: 'Pink', color: '#fdf2f8', borderColor: '#fbcfe8', accentColor: '#fce7f3', textColor: '#be185d' },
];

interface AddCategoryModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (name: string, scheme: ColorScheme) => void;
}

export function AddCategoryModal({ visible, onClose, onAdd }: AddCategoryModalProps) {
    const [name, setName] = useState('');
    const [selectedSchemeId, setSelectedSchemeId] = useState(COLOR_SCHEMES[0].id);

    const handleAdd = () => {
        if (!name.trim()) return;
        const scheme = COLOR_SCHEMES.find(s => s.id === selectedSchemeId);
        if (scheme) {
            onAdd(name.trim(), scheme);
            setName('');
            setSelectedSchemeId(COLOR_SCHEMES[0].id);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Category</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.label}>Category Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Hotel Vouchers"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />

                        <Text style={styles.label}>Select Color</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.colorList}
                        >
                            {COLOR_SCHEMES.map((scheme) => (
                                <TouchableOpacity
                                    key={scheme.id}
                                    style={[
                                        styles.colorItem,
                                        { backgroundColor: scheme.color, borderColor: scheme.borderColor },
                                        selectedSchemeId === scheme.id && styles.selectedColorItem,
                                    ]}
                                    onPress={() => setSelectedSchemeId(scheme.id)}
                                >
                                    {selectedSchemeId === scheme.id && (
                                        <Ionicons name="checkmark" size={20} color={scheme.textColor} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <TouchableOpacity
                        style={[styles.addButton, !name.trim() && styles.disabledButton]}
                        onPress={handleAdd}
                        disabled={!name.trim()}
                    >
                        <Text style={styles.addButtonText}>Create Category</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    form: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#111827',
        marginBottom: 20,
    },
    colorList: {
        paddingVertical: 4,
        gap: 12,
    },
    colorItem: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedColorItem: {
        transform: [{ scale: 1.1 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    addButton: {
        backgroundColor: '#6366f1',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#9ca3af',
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
