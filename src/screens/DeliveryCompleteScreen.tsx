import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import SignaturePad from '../components/SignaturePad';
import { RouteStop, Route } from '../types';
import { scanPackage, completeStopLocal } from '../services/api';
import { saveProofLocally } from '../services/localProofStorage';

interface Props {
  stop: RouteStop;
  route: Route;
  onBack: () => void;
  onCompleted: () => void;
}

type Step = 'scan' | 'proof' | 'done';

export default function DeliveryCompleteScreen({ stop, route, onBack, onCompleted }: Props) {
  const [step, setStep] = useState<Step>(stop.packageScanned ? 'proof' : 'scan');
  const [scanning, setScanning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sigModalVisible, setSigModalVisible] = useState(false);

  const delivery = stop.delivery;
  const prescriptions = stop.prescriptions ?? [];

  async function handleBarcodeScan({ data }: { data: string }) {
    setScanning(false);
    try {
      await scanPackage(route.id, stop.id, data);
      setStep('proof');
    } catch (e: any) {
      Alert.alert('Scan Failed', e.message);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const routeId = Number(route?.id);
      const stopId = Number(stop?.id);
      if (!routeId || !stopId) {
        Alert.alert('Error', `Missing IDs (route=${route?.id}, stop=${stop?.id}).`);
        return;
      }
      const localId = `proof_${routeId}_${stopId}_${Date.now()}`;
      await saveProofLocally({
        localId, routeId, stopId,
        signatureData: signature ?? undefined,
        photoUri: photoUri ?? undefined,
        recipientName: recipientName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      await completeStopLocal(routeId, stopId, {
        localProofId: localId,
        recipientName: recipientName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setStep('done');
      setTimeout(onCompleted, 1500);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Scan ──────────────────────────────────────────────────────────────────────
  if (step === 'scan') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Package</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.stopInfo}>
            <Text style={styles.customerName}>{delivery?.customerName ?? 'Customer'}</Text>
            <Text style={styles.address}>{delivery?.addressText ?? ''}</Text>
            {prescriptions.length > 0 && (
              <View style={styles.rxList}>
                <Text style={styles.rxLabel}>Prescriptions:</Text>
                {prescriptions.map((rx: any) => (
                  <View key={rx.id} style={styles.rxRow}>
                    <Ionicons name="medical-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.rxText}>{rx.rxNumber}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.scanBtn} onPress={() => setScanning(true)}>
            <Ionicons name="barcode-outline" size={28} color="#3B82F6" />
            <Text style={styles.scanBtnText}>Open Barcode Scanner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('proof')}>
            <Text style={styles.skipText}>Skip — go to proof of delivery</Text>
          </TouchableOpacity>
        </ScrollView>
        {scanning && (
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={handleBarcodeScan}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanWindow} />
              <Text style={styles.scanHint}>Point camera at barcode</Text>
            </View>
            <TouchableOpacity style={styles.closeScan} onPress={() => setScanning(false)}>
              <Ionicons name="close-circle" size={48} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={[styles.safe, styles.doneContainer]}>
        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
        <Text style={styles.doneTitle}>Delivery Confirmed!</Text>
        <Text style={styles.doneSubtitle}>Moving to next stop…</Text>
      </SafeAreaView>
    );
  }

  // ── Proof ─────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proof of Delivery</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.stopInfo}>
            <Text style={styles.customerName}>{delivery?.customerName ?? 'Customer'}</Text>
            <Text style={styles.address}>{delivery?.addressText ?? ''}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Received by</Text>
            <TextInput
              style={styles.input}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Recipient name (optional)"
              placeholderTextColor="#6B7280"
              returnKeyType="done"
            />
          </View>

          {/* Signature button — opens fullscreen modal */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Signature</Text>
            <TouchableOpacity
              style={[styles.sigTrigger, signature && styles.sigTriggerDone]}
              onPress={() => setSigModalVisible(true)}
            >
              <Ionicons
                name={signature ? 'checkmark-circle' : 'pencil-outline'}
                size={22}
                color={signature ? '#10B981' : '#9CA3AF'}
              />
              <Text style={[styles.sigTriggerText, signature && { color: '#10B981' }]}>
                {signature ? 'Signature captured — tap to redo' : 'Tap to sign'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Photo proof</Text>
            <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
              <Ionicons
                name={photoUri ? 'checkmark-circle' : 'camera-outline'}
                size={22}
                color={photoUri ? '#10B981' : '#9CA3AF'}
              />
              <Text style={[styles.photoBtnText, photoUri && { color: '#10B981' }]}>
                {photoUri ? 'Photo taken ✓' : 'Take a photo'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any delivery notes…"
              placeholderTextColor="#6B7280"
              multiline
              blurOnSubmit
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Complete Delivery</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/*
        Signature Modal — fullscreen, no scroll container, pure drawing surface.
        SignaturePad stays mounted even when modal is hidden (preserves stroke state)
        by using `visible` to show/hide rather than conditionally rendering.
      */}
      <Modal
        visible={sigModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setSigModalVisible(false)}
      >
        <SafeAreaView style={styles.sigModalSafe}>
          <View style={styles.sigModalHeader}>
            <Text style={styles.sigModalTitle}>Customer Signature</Text>
            <TouchableOpacity
              onPress={() => setSigModalVisible(false)}
              style={styles.sigModalClose}
            >
              <Ionicons name="close" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.sigModalBody}>
            <Text style={styles.sigModalHint}>
              Have the customer sign below, then tap Save Signature
            </Text>
            <SignaturePad
              onSave={(base64Png) => {
                setSignature(base64Png);
                setSigModalVisible(false);
              }}
              onClear={() => setSignature(null)}
            />
            <Text style={styles.sigModalNote}>
              Draw with finger. Tap Clear to start over.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1F2937',
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 20 },
  stopInfo: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#374151',
  },
  customerName: { fontSize: 17, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  address: { fontSize: 14, color: '#9CA3AF' },
  rxList: { marginTop: 10 },
  rxLabel: {
    fontSize: 11, color: '#6B7280', marginBottom: 6,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4,
  },
  rxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rxText: { color: '#D1D5DB', fontSize: 13 },
  scanBtn: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: '#3B82F6', marginBottom: 12,
  },
  scanBtnText: { color: '#3B82F6', fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', padding: 12 },
  skipText: { color: '#6B7280', fontSize: 14 },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanWindow: {
    width: 260, height: 160, borderRadius: 12,
    borderWidth: 2, borderColor: '#3B82F6', backgroundColor: 'transparent',
  },
  scanHint: { color: '#fff', marginTop: 16, fontSize: 15 },
  closeScan: { position: 'absolute', bottom: 56, alignSelf: 'center' },
  field: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sigTrigger: {
    backgroundColor: '#1F2937', borderRadius: 12, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#374151',
  },
  sigTriggerDone: { borderColor: '#10B981' },
  sigTriggerText: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: '#1F2937', borderRadius: 10, padding: 14,
    color: '#F9FAFB', fontSize: 15, borderWidth: 1, borderColor: '#374151',
  },
  photoBtn: {
    backgroundColor: '#1F2937', borderRadius: 10, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#374151',
  },
  photoBtnText: { color: '#9CA3AF', fontSize: 15 },
  submitBtn: {
    backgroundColor: '#10B981', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  doneContainer: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  doneTitle: { fontSize: 26, fontWeight: '800', color: '#F9FAFB' },
  doneSubtitle: { fontSize: 15, color: '#9CA3AF' },
  sigModalSafe: { flex: 1, backgroundColor: '#111827' },
  sigModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#374151',
  },
  sigModalTitle: { fontSize: 20, fontWeight: '700', color: '#F9FAFB' },
  sigModalClose: { padding: 4 },
  sigModalBody: { flex: 1, padding: 20, justifyContent: 'center' },
  sigModalHint: { color: '#9CA3AF', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  sigModalNote: { color: '#4B5563', fontSize: 12, marginTop: 12, textAlign: 'center' },
});
