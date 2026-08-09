import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import PDFService, { PDFDocument } from '../services/PDFService';
import { forgetSuggestion, NameSuggestion, suggestDocumentName } from '../services/DocumentName';
import { Texture } from './physical/Texture';

interface FileInfo {
  name: string;
  size?: number;
  uri: string;
}

interface AddDocumentModalProps {
  visible: boolean;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onDocumentAdded: (document: PDFDocument) => void;
  existingTravelerNames?: string[];
  accent?: string;
}

export function AddDocumentModal({
  visible,
  categoryId,
  categoryName,
  onClose,
  onDocumentAdded,
  existingTravelerNames = [],
  accent = '#2563eb',
}: AddDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [travelerName, setTravelerName] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<NameSuggestion | null>(null);
  const [reading, setReading] = useState(false);
  /**
   * Which pick a reading belongs to.
   *
   * Reading a document takes long enough that a second file can be chosen
   * before the first one answers, and the answer for a file that is no longer
   * on screen must not fill the field.
   */
  const pickToken = useRef(0);
  /**
   * The name the field was last filled with on our own initiative.
   *
   * The reading arrives after the file name has already gone in, so replacing
   * it means overwriting something. Comparing against what we put there is how
   * a field the person has since typed into is left alone.
   */
  const filledWith = useRef('');

  /** Asks the document what it is, and names it if it says. */
  const readName = async (uri: string, fileName: string, token: number) => {
    setReading(true);
    try {
      const found = await suggestDocumentName(uri, fileName);
      if (pickToken.current !== token) return;
      if (!found.fromDocument || !found.name) return;

      setSuggestion(found);
      setDocumentName((current) => {
        if (current && current !== filledWith.current) return current;
        filledWith.current = found.name;
        return found.name;
      });
    } catch (error) {
      console.warn('Could not read a document name:', error);
    } finally {
      if (pickToken.current === token) setReading(false);
    }
  };

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 50 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a PDF smaller than 50MB.');
        return;
      }
      setSelectedFile({ name: asset.name, size: asset.size, uri: asset.uri });
      // The file name goes in straight away so the field is never empty, and
      // the document gets read behind it — imported files are often called
      // things like "lvtckt-28332756-59C542D280E877B0", and reading a PDF
      // takes long enough to be worth not waiting on.
      const stem = asset.name.replace(/\.pdf$/i, '');
      filledWith.current = stem;
      setDocumentName(stem);

      // A replaced file makes the previous document's name wrong, so the old
      // reading goes with it.
      const token = ++pickToken.current;
      setSuggestion(null);
      readName(asset.uri, asset.name, token);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Could not open the file picker.');
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTravelerName('');
    setDocumentName('');
    setSuggestion(null);
    setReading(false);
    pickToken.current++;
    filledWith.current = '';
  };

  const canAdd = !!selectedFile && !!travelerName.trim() && !isLoading;

  /**
   * The reading, while it is still the name in the field.
   *
   * Typing over it settles the question — the note explaining where the name
   * came from would then be describing a name that is no longer there.
   */
  const shownSuggestion = suggestion && documentName === suggestion.name ? suggestion : null;

  const handleAddDocument = async () => {
    if (!canAdd || !selectedFile) return;
    setIsLoading(true);
    try {
      const document = await PDFService.addDocument(
        categoryId,
        selectedFile.uri,
        selectedFile.name,
        travelerName.trim(),
        documentName
      );
      // The import copy is kept under a different path, so the parse held
      // against the picked one is now unreachable.
      forgetSuggestion(selectedFile.uri);
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

  const formatSize = (size?: number) =>
    size !== undefined ? `${(size / 1024).toFixed(1)} KB` : 'Unknown size';

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
                <View style={[styles.headerIcon, { backgroundColor: accent }]}>
                  <Ionicons name="document-attach" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Slip a document in</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    Into {categoryName}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/*
                Scrolls so the keyboard can never push the button out of reach.
                The form grows by two fields once a paper is in, and on a small
                phone that plus a keyboard is taller than the screen.
              */}
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* The paper itself */}
                <Animated.View entering={FadeInUp.springify().delay(60)} style={styles.section}>
                  <Text style={styles.label}>THE PAPER</Text>
                  {selectedFile ? (
                    <Pressable
                      style={({ pressed }) => [styles.slip, pressed && styles.pressed]}
                      onPress={pickPdf}
                      accessibilityRole="button"
                      accessibilityLabel="Choose a different PDF"
                    >
                      <Texture variant="paper" opacity={0.7} />
                      <View style={styles.slipFold} pointerEvents="none" />
                      <View style={[styles.slipIcon, { backgroundColor: accent }]}>
                        <Ionicons name="document-text" size={15} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.slipName} numberOfLines={1}>
                          {selectedFile.name}
                        </Text>
                        <Text style={styles.slipMeta}>{formatSize(selectedFile.size)}</Text>
                      </View>
                      <Ionicons name="swap-horizontal" size={15} color="#8a7d68" />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.dropSlot,
                        { borderColor: accent },
                        pressed && styles.pressed,
                      ]}
                      onPress={pickPdf}
                      accessibilityRole="button"
                      accessibilityLabel="Choose a PDF"
                    >
                      <Ionicons name="document-outline" size={24} color={accent} />
                      <Text style={[styles.dropSlotText, { color: accent }]}>CHOOSE A PDF</Text>
                      <Text style={styles.dropSlotHint}>UP TO 50 MB</Text>
                    </Pressable>
                  )}
                </Animated.View>

                {/*
                  Both questions wait for the paper.
                  Asking whose a document is before there is a document made the
                  panel open as a form with a disabled button under it; this way
                  it opens as one invitation and grows into the rest.
                */}
                {selectedFile && (
                  <>
                    <Animated.View entering={FadeInUp.springify()} style={styles.section}>
                      <Text style={styles.label}>CALL IT</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Document name"
                        placeholderTextColor="#9aa4b2"
                        value={documentName}
                        onChangeText={setDocumentName}
                        autoCapitalize="sentences"
                        returnKeyType="next"
                      />

                      {/*
                        Typed in the same hand as the field captions, because it
                        is an annotation on the form and not a thing to do — the
                        name is already in, and this only says where it came
                        from and how to undo it.
                      */}
                      {(reading || shownSuggestion) && (
                        <View style={styles.note}>
                          {reading ? (
                            <>
                              <ActivityIndicator size="small" color="#94a3b8" />
                              <Text style={styles.noteText}>READING THE DOCUMENT</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="scan-outline" size={11} color="#8a94a6" />
                              <Text style={styles.noteText}>READ OFF THE DOCUMENT</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  const stem = selectedFile.name.replace(/\.pdf$/i, '');
                                  filledWith.current = stem;
                                  setDocumentName(stem);
                                }}
                                hitSlop={10}
                              >
                                <Text style={[styles.noteAction, { color: accent }]}>
                                  USE FILE NAME
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      )}
                    </Animated.View>

                    <Animated.View
                      entering={FadeInUp.springify().delay(60)}
                      style={styles.sectionLast}
                    >
                      <Text style={styles.label}>WHOSE IS IT?</Text>
                      {existingTravelerNames.length > 0 && (
                        <View style={styles.chipRow}>
                          {existingTravelerNames.map((name) => {
                            const active = travelerName === name;
                            return (
                              <TouchableOpacity
                                key={name}
                                style={[
                                  styles.chip,
                                  { borderColor: accent },
                                  active && { backgroundColor: accent, borderColor: accent },
                                ]}
                                onPress={() => setTravelerName(active ? '' : name)}
                              >
                                <Text
                                  style={[styles.chipText, { color: active ? '#fff' : accent }]}
                                >
                                  {name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                      <TextInput
                        style={styles.input}
                        placeholder="Traveler name"
                        placeholderTextColor="#9aa4b2"
                        value={travelerName}
                        onChangeText={setTravelerName}
                        autoCapitalize="words"
                        returnKeyType="done"
                        onSubmitEditing={handleAddDocument}
                      />
                    </Animated.View>
                  </>
                )}
              </ScrollView>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: accent }, !canAdd && styles.addDisabled]}
                onPress={handleAddDocument}
                disabled={!canAdd}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="enter-outline" size={16} color="#fff" />
                    <Text style={styles.addButtonText}>Tuck it in</Text>
                  </>
                )}
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

/** The stock a document is printed on, shared with the card in TossConfirm. */
const PAPER = '#f6f1e7';
const PAPER_EDGE = 'rgba(67,57,44,0.26)';
const PAPER_INK = '#2b2318';

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
    // Lets the panel shrink under the keyboard instead of running off-screen.
    flexShrink: 1,
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
    flexShrink: 1,
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
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748b',
    marginTop: 3,
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
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: 2,
  },
  /** One rhythm for every question on the form. */
  section: {
    marginBottom: 18,
  },
  sectionLast: {
    marginBottom: 0,
  },
  /**
   * Field captions, set in the typewriter the passport form is filled in with.
   * It is what makes the panel read as a form rather than as a settings sheet.
   */
  label: {
    fontSize: 9.5,
    fontFamily: 'SpaceMono',
    letterSpacing: 1.6,
    color: '#7c8698',
    marginBottom: 8,
  },
  dropSlot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 24,
  },
  dropSlotText: {
    fontSize: 10,
    fontFamily: 'SpaceMono',
    letterSpacing: 2,
  },
  dropSlotHint: {
    fontSize: 8.5,
    fontFamily: 'SpaceMono',
    letterSpacing: 1.4,
    color: '#9aa4b2',
  },
  /**
   * The chosen file, as a piece of paper.
   *
   * Same stock, grain and folded corner as the card held up in TossConfirm, so
   * a document looks like the same object wherever the app shows one — on the
   * shelf, in the hand, or on its way into a folder.
   */
  slip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PAPER,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER_EDGE,
    borderRadius: 12,
    padding: 13,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  /** The turned-back corner, showing the underside of the sheet. */
  slipFold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 17,
    borderLeftWidth: 17,
    borderTopColor: '#e4d8c1',
    borderLeftColor: 'transparent',
  },
  slipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slipName: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    letterSpacing: -0.1,
    color: PAPER_INK,
  },
  slipMeta: {
    fontSize: 9.5,
    fontFamily: 'SpaceMono',
    letterSpacing: 0.6,
    color: '#8a7d68',
    marginTop: 3,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0f172a',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 9,
    paddingHorizontal: 2,
  },
  noteText: {
    flex: 1,
    fontSize: 8.5,
    fontFamily: 'SpaceMono',
    letterSpacing: 1.1,
    color: '#8a94a6',
  },
  noteAction: {
    fontSize: 8.5,
    fontFamily: 'SpaceMono',
    letterSpacing: 1.1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  addDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
});
