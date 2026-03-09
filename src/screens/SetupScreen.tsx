import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, setBaseUrl, fetchDrivers, setDriverId, getDriverId } from '../services/api';

interface Props {
  onSetup: (driverId: number) => void;
}

export default function SetupScreen({ onSetup }: Props) {
  const [serverUrl, setServerUrl] = useState('');
  const [drivers, setDrivers] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getBaseUrl().then((url) => {
      if (url) setServerUrl(url);
    });
  }, []);

  async function handleConnect() {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter the server URL');
      return;
    }
    setLoading(true);
    try {
      await setBaseUrl(serverUrl.trim());
      const list = await fetchDrivers();
      setDrivers(list);
      setConnected(true);
    } catch (e: any) {
      Alert.alert('Connection Failed', e.message ?? 'Cannot reach server');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectDriver(id: number) {
    await setDriverId(id);
    onSetup(id);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="car" size={40} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Driver App</Text>
          <Text style={styles.subtitle}>Connect to your dispatch server</Text>
        </View>

        {/* Server URL */}
        <View style={styles.card}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="https://your-app.replit.dev"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleConnect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Driver list */}
        {connected && (
          <View style={styles.card}>
            <Text style={styles.label}>Select Your Driver Profile</Text>
            {drivers.length === 0 ? (
              <Text style={styles.empty}>No drivers found. Ask your dispatcher to add you.</Text>
            ) : (
              drivers.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.driverRow}
                  onPress={() => handleSelectDriver(d.id)}
                >
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>{d.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{d.name}</Text>
                    <Text style={styles.driverPhone}>{d.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  container: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
  logoContainer: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#1F2937',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#374151',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#9CA3AF' },
  card: {
    backgroundColor: '#1F2937', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#374151',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#111827', borderRadius: 10, padding: 14,
    color: '#F9FAFB', fontSize: 15, marginBottom: 12,
    borderWidth: 1, borderColor: '#374151',
  },
  btn: {
    backgroundColor: '#3B82F6', borderRadius: 10, padding: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: { color: '#6B7280', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#374151',
  },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  driverAvatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  driverName: { color: '#F9FAFB', fontWeight: '600', fontSize: 16 },
  driverPhone: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
});
