import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';

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

  const scheme = COLOR_SCHEMES.find((s) => s.id === selectedSchemeId) ?? COLOR_SCHEMES[0];

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), scheme);
    setName('');
    setSelectedSchemeId(COLOR_SCHEMES[0].id);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={50} tint="dark" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
          pointerEvents="box-none"
        >
          <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.panelWrap}>
            <BlurView intensity={85} tint="light" style={styles.panel}>
              <View style={styles.panelTint} pointerEvents="none" />
              <View style={styles.glassEdge} pointerEvents="none" />

              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.headerIcon, { backgroundColor: scheme.textColor }]}>
                  <Ionicons name="folder-open" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>A new folder</Text>
                  <Text style={styles.subtitle}>For paperwork that needs its own home</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Live folder preview */}
              <Animated.View entering={FadeInUp.springify().delay(60)} style={styles.previewRow}>
                <View style={styles.previewFolder}>
                  <View style={[styles.previewTab, { backgroundColor: scheme.accentColor }]} />
                  <View style={styles.previewBody}>
                    <View style={styles.previewLabel}>
                      <Text
                        style={[styles.previewLabelText, { color: scheme.textColor }]}
                        numberOfLines={2}
                      >
                        {name.trim() || 'Untitled'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>

              {/* Name */}
              <Animated.View entering={FadeInUp.springify().delay(120)}>
                <Text style={styles.label}>WRITE ON THE TAB</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Hotel Vouchers"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                />
              </Animated.View>

              {/* Tab color */}
              <Animated.View entering={FadeInUp.springify().delay(180)}>
                <Text style={styles.label}>PICK A TAB COLOR</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabList}
                >
                  {COLOR_SCHEMES.map((s) => {
                    const active = selectedSchemeId === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.tabSwatch,
                          { backgroundColor: s.accentColor, borderColor: s.borderColor },
                          active && { borderColor: s.textColor, transform: [{ translateY: -4 }] },
                        ]}
                        onPress={() => setSelectedSchemeId(s.id)}
                      >
                        {active && <Ionicons name="checkmark" size={14} color={s.textColor} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Animated.View>

              {/* Create */}
              <TouchableOpacity
                style={[
                  styles.createButton,
                  { backgroundColor: scheme.textColor },
                  !name.trim() && styles.createDisabled,
                ]}
                onPress={handleAdd}
                disabled={!name.trim()}
                activeOpacity={0.85}
              >
                <Ionicons name="folder-outline" size={16} color="#fff" />
                <Text style={styles.createButtonText}>Put it on the shelf</Text>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  keyboardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panelWrap: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  panel: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 20,
  },
  panelTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  glassEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15,23,42,0.08)',
    marginVertical: 14,
  },
  previewRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewFolder: {
    width: 132,
    height: 110,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  previewTab: {
    alignSelf: 'flex-start',
    width: '46%',
    height: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  previewBody: {
    flex: 1,
    backgroundColor: '#e8c68f',
    borderRadius: 8,
    borderTopLeftRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    width: '74%',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(122,92,46,0.25)',
  },
  previewLabelText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#64748b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 16,
  },
  tabList: {
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  tabSwatch: {
    width: 44,
    height: 30,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  createDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
